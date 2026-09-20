import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../api/supabase';
import { getApiBaseUrl } from '../api/client';

const AuthContext = createContext({});

const logUserActivity = async (token, eventType, details = {}, employeeName = '') => {
  if (!token) return;
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/employee/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        event_type: eventType,
        details,
        employee_name: employeeName
      })
    });
  } catch (err) {
    // Non-blocking background log
    console.warn('[Auth] Background activity log error:', err);
  }
};

const getCachedRole = (userId) => {
  if (!userId) return null;
  try {
    return localStorage.getItem(`flavour_role_${userId}`);
  } catch (e) {
    return null;
  }
};

const getCachedDisplayName = (userId) => {
  if (!userId) return '';
  try {
    return localStorage.getItem(`flavour_name_${userId}`) || '';
  } catch (e) {
    return '';
  }
};

const setCachedUser = (userId, role, displayName) => {
  if (!userId) return;
  try {
    if (role) localStorage.setItem(`flavour_role_${userId}`, role);
    if (displayName) localStorage.setItem(`flavour_name_${userId}`, displayName);
  } catch (e) {
    // Ignore storage quota/private mode errors
  }
};

const clearCachedUser = (userId) => {
  try {
    if (userId) {
      localStorage.removeItem(`flavour_role_${userId}`);
      localStorage.removeItem(`flavour_name_${userId}`);
    }
  } catch (e) {
    // Ignore
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [accessRestrictedError, setAccessRestrictedError] = useState(null);

  // Tracks the latest auth request to prevent stale async callbacks from overwriting newer ones
  const roleRequestId = useRef(0);

  /**
   * Determine user role with a strict 3.5s timeout.
   * If network hangs or Supabase takes too long, fall back to cached role or metadata.
   */
  const fetchUserRole = async (user) => {
    if (!user) return { role: null, displayName: '' };

    const cachedRole = getCachedRole(user.id);
    const cachedName = getCachedDisplayName(user.id);

    try {
      // Create a 3.5-second timeout promise
      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('user_profiles query timeout')), 3500);
      });

      const dbPromise = supabase
        .from('user_profiles')
        .select('role, display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: profile, error } = await Promise.race([dbPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);

      if (!error && profile && profile.role) {
        const resolvedRole = profile.role === 'admin' ? 'admin' : 'employee';
        const resolvedName = profile.display_name || user.email || '';
        setCachedUser(user.id, resolvedRole, resolvedName);
        console.log('[Auth] Role resolved from DB:', resolvedRole);
        return { role: resolvedRole, displayName: resolvedName };
      }

      // If DB returned no row or an error, check cached role first
      if (cachedRole) {
        console.log('[Auth] Using cached role (DB returned empty/error):', cachedRole);
        return { role: cachedRole, displayName: cachedName || user.email || '' };
      }

      // Fallback to metadata
      const metaRole = user.user_metadata?.role || user.app_metadata?.role;
      if (metaRole) {
        const resolvedRole = metaRole === 'admin' ? 'admin' : 'employee';
        console.log('[Auth] Role resolved from metadata:', resolvedRole);
        return { role: resolvedRole, displayName: user.user_metadata?.display_name || user.email || '' };
      }

      // Default: employee
      return { role: 'employee', displayName: user.email || 'Employee' };
    } catch (err) {
      console.warn('[Auth] DB role check failed or timed out:', err.message);

      // Graceful fallback on network/timeout error
      if (cachedRole) {
        console.log('[Auth] Falling back to cached role after error:', cachedRole);
        return { role: cachedRole, displayName: cachedName || user.email || '' };
      }

      const metaRole = user.user_metadata?.role || user.app_metadata?.role;
      if (metaRole) {
        return { role: metaRole === 'admin' ? 'admin' : 'employee', displayName: user.email || '' };
      }

      return { role: 'employee', displayName: user.email || 'Employee' };
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Hard global safety timeout: NEVER leave the application locked in loading state
    const globalSafetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Global safety timeout reached — releasing loading spinner');
        setLoading(false);
        setRoleLoading(false);
      }
    }, 4000);

    const handleSessionChange = async (event, currentSession) => {
      if (!isMounted) return;

      const thisRequestId = ++roleRequestId.current;
      console.log('[Auth] Auth event:', event, 'session:', !!currentSession, 'reqId:', thisRequestId);

      setSession(currentSession);

      if (currentSession?.user) {
        const user = currentSession.user;
        const cachedRole = getCachedRole(user.id);
        const cachedName = getCachedDisplayName(user.id);

        // If we already have a cached role, apply it IMMEDIATELY so returning users
        // see ZERO spinner delay and the layout mounts immediately.
        if (cachedRole) {
          setRole(cachedRole);
          setDisplayName(cachedName || user.email || '');
          setRoleLoading(false);
          setLoading(false);
        } else {
          setRoleLoading(true);
        }

        try {
          const { role: userRole, displayName: name } = await fetchUserRole(user);

          if (isMounted && thisRequestId === roleRequestId.current) {
            // If user is employee, verify if business hours / restriction applies
            if (userRole === 'employee') {
              try {
                const baseUrl = getApiBaseUrl();
                const statusRes = await fetch(`${baseUrl}/employee/access-status`).then((r) => r.json()).catch(() => null);
                if (statusRes?.data && !statusRes.data.allowed) {
                  console.warn('[Auth] Employee access restricted:', statusRes.data.reason);
                  const restrictMsg = statusRes.data.message || 'Employee logins are restricted outside business hours.';
                  setAccessRestrictedError(restrictMsg);

                  // Audit blocked login
                  logUserActivity(
                    currentSession.access_token,
                    'LOGIN_BLOCKED',
                    { reason: statusRes.data.reason, message: restrictMsg, eventSource: event },
                    name || user.email
                  );

                  // Sign out immediately so employee cannot access the portal
                  clearCachedUser(user.id);
                  setSession(null);
                  setRole(null);
                  setDisplayName('');
                  await supabase.auth.signOut();
                  return;
                } else {
                  setAccessRestrictedError(null);
                }
              } catch (accessErr) {
                console.warn('[Auth] Access status check failed:', accessErr);
              }
            }

            setRole(userRole);
            setDisplayName(name);

            // Audit employee login (deduplicated per browser session)
            if (userRole === 'employee') {
              const sessionKey = `flavour_logged_${user.id}`;
              const alreadyLogged = sessionStorage.getItem(sessionKey);
              if (event === 'SIGNED_IN' || (!alreadyLogged && event === 'INITIAL_GET_SESSION')) {
                sessionStorage.setItem(sessionKey, 'true');
                logUserActivity(currentSession.access_token, 'LOGIN', { eventSource: event }, name || user.email);
              }
            }
          }
        } catch (err) {
          console.error('[Auth] Unexpected error in role resolution:', err);
        } finally {
          // ALWAYS clear loading states for the latest request
          if (isMounted && thisRequestId === roleRequestId.current) {
            setRoleLoading(false);
            setLoading(false);
            clearTimeout(globalSafetyTimer);
            console.log('[Auth] Loading lock cleared for reqId:', thisRequestId);
          }
        }
      } else {
        setRole(null);
        setDisplayName('');
        setRoleLoading(false);
        setLoading(false);
        clearTimeout(globalSafetyTimer);
      }
    };

    // 1. Actively check existing session from storage on mount (instant restore)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted && initialSession) {
        handleSessionChange('INITIAL_GET_SESSION', initialSession);
      }
    }).catch(err => {
      console.warn('[Auth] getSession failed on mount:', err);
    });

    // 2. Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleSessionChange(event, currentSession);
    });

    return () => {
      isMounted = false;
      clearTimeout(globalSafetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      if (session?.user?.id) {
        sessionStorage.removeItem(`flavour_logged_${session.user.id}`);
        if (session.access_token) {
          // Background fire-and-forget logout audit
          logUserActivity(session.access_token, 'LOGOUT', {}, displayName || session.user.email);
        }
        clearCachedUser(session.user.id);
      }
    } catch (e) {
      // Ignore
    }
    setRole(null);
    setDisplayName('');
    setSession(null);
    setLoading(false);
    setRoleLoading(false);
    await supabase.auth.signOut();
  };

  const logActivity = (eventType, details = {}) => {
    if (session?.access_token) {
      logUserActivity(session.access_token, eventType, details, displayName || session?.user?.email);
    }
  };

  const value = {
    session,
    role,
    displayName,
    loading,
    roleLoading,
    accessRestrictedError,
    clearAccessRestrictedError: () => setAccessRestrictedError(null),
    user: session?.user,
    signOut,
    logActivity,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
