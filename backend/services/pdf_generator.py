# backend/services/pdf_generator.py
# Invoice PDF generation using ReportLab.
# Produces a clean, professional invoice layout.

import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def generate_invoice_pdf(invoice, items, customer):
    """
    Generate a PDF invoice and return the bytes.
    
    Args:
        invoice: dict with invoice fields (invoice_number, invoice_date, due_date,
                 subtotal, discount_pct, gst_pct, total, amount_paid, notes, status)
        items: list of dicts (product_name, qty, unit_price, line_total)
        customer: dict with customer fields (name, company_name, phone, email,
                  address, gst_number)
    
    Returns:
        bytes — PDF file content
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Title"],
        fontSize=22,
        spaceAfter=2 * mm,
        textColor=colors.HexColor("#1a1a2e"),
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=11,
        textColor=colors.HexColor("#4a4a6a"),
        spaceBefore=4 * mm,
        spaceAfter=2 * mm,
    )
    normal_style = ParagraphStyle(
        "NormalCustom",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
    )
    right_style = ParagraphStyle(
        "RightAligned",
        parent=normal_style,
        alignment=TA_RIGHT,
    )
    bold_style = ParagraphStyle(
        "BoldCustom",
        parent=normal_style,
        fontName="Helvetica-Bold",
    )

    elements = []

    # ── Header: Business name + Invoice number ─────────────────────────
    elements.append(Paragraph("Flavour & Essence", title_style))
    elements.append(Paragraph(
        "Home Manufacturing Business<br/>"
        "Contact: business@example.com | +91 XXXXX XXXXX",
        normal_style
    ))
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor("#e0e0e0"), spaceAfter=4 * mm
    ))

    # ── Invoice details (two-column layout via table) ──────────────────
    inv_number = invoice.get("invoice_number", "—")
    inv_date = invoice.get("invoice_date", "—")
    due_date = invoice.get("due_date", "—") or "—"
    status = (invoice.get("status", "draft") or "draft").upper()

    details_data = [
        [
            Paragraph(f"<b>Invoice #:</b> {inv_number}", normal_style),
            Paragraph(f"<b>Date:</b> {inv_date}", right_style),
        ],
        [
            Paragraph(f"<b>Status:</b> {status}", normal_style),
            Paragraph(f"<b>Due Date:</b> {due_date}", right_style),
        ],
    ]
    details_table = Table(details_data, colWidths=["50%", "50%"])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 4 * mm))

    # ── Bill To ────────────────────────────────────────────────────────
    elements.append(Paragraph("Bill To", heading_style))
    cust_name = customer.get("name", "—")
    cust_company = customer.get("company_name", "")
    cust_phone = customer.get("phone", "")
    cust_email = customer.get("email", "")
    cust_address = customer.get("address", "")
    cust_gst = customer.get("gst_number", "")

    bill_to_lines = [f"<b>{cust_name}</b>"]
    if cust_company:
        bill_to_lines.append(cust_company)
    if cust_address:
        bill_to_lines.append(cust_address)
    if cust_phone:
        bill_to_lines.append(f"Phone: {cust_phone}")
    if cust_email:
        bill_to_lines.append(f"Email: {cust_email}")
    if cust_gst:
        bill_to_lines.append(f"GST: {cust_gst}")

    elements.append(Paragraph("<br/>".join(bill_to_lines), normal_style))
    elements.append(Spacer(1, 4 * mm))

    # ── Line items table ───────────────────────────────────────────────
    elements.append(Paragraph("Items", heading_style))

    table_data = [["#", "Product", "Qty", "Unit Price (₹)", "Total (₹)"]]
    for i, item in enumerate(items, 1):
        table_data.append([
            str(i),
            str(item.get("product_name", "—")),
            str(item.get("qty", 0)),
            f"₹{float(item.get('unit_price', 0)):,.2f}",
            f"₹{float(item.get('line_total', 0)):,.2f}",
        ])

    item_table = Table(table_data, colWidths=["8%", "40%", "12%", "20%", "20%"])
    item_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Data rows
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5fa")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d0d0e0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 4 * mm))

    # ── Totals ─────────────────────────────────────────────────────────
    subtotal = float(invoice.get("subtotal", 0))
    discount_pct = float(invoice.get("discount_pct", 0))
    gst_pct = float(invoice.get("gst_pct", 0))
    total = float(invoice.get("total", 0))
    amount_paid = float(invoice.get("amount_paid", 0))
    balance = total - amount_paid

    discount_amt = subtotal * (discount_pct / 100) if discount_pct else 0
    gst_amt = (subtotal - discount_amt) * (gst_pct / 100) if gst_pct else 0

    totals_data = [
        ["", "Subtotal:", f"₹{subtotal:,.2f}"],
    ]
    if discount_pct:
        totals_data.append(["", f"Discount ({discount_pct}%):", f"- ₹{discount_amt:,.2f}"])
    if gst_pct:
        totals_data.append(["", f"GST ({gst_pct}%):", f"+ ₹{gst_amt:,.2f}"])
    totals_data.append(["", "Total:", f"₹{total:,.2f}"])
    totals_data.append(["", "Paid:", f"₹{amount_paid:,.2f}"])
    totals_data.append(["", "Balance Due:", f"₹{balance:,.2f}"])

    totals_table = Table(totals_data, colWidths=["50%", "30%", "20%"])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("FONTNAME", (1, -1), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (1, -1), (2, -1), 1, colors.HexColor("#1a1a2e")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(totals_table)

    # ── Notes ──────────────────────────────────────────────────────────
    notes = invoice.get("notes", "")
    if notes:
        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph("Notes", heading_style))
        elements.append(Paragraph(notes, normal_style))

    # ── Footer ─────────────────────────────────────────────────────────
    elements.append(Spacer(1, 10 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.5,
        color=colors.HexColor("#c0c0c0"), spaceAfter=2 * mm
    ))
    elements.append(Paragraph(
        "Thank you for your business!",
        ParagraphStyle("Footer", parent=normal_style, alignment=TA_CENTER,
                       textColor=colors.HexColor("#888888"), fontSize=8)
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_formula_pdf(product, formula_lines, original_batch_size=None):
    """
    Generate a Production Batch Sheet (Formula) and return the bytes.
    
    Args:
        product: dict with product fields (name, batch_size, batch_unit, cost_price)
        formula_lines: list of dicts (raw_material_name, qty_per_batch, unit)
        original_batch_size: if set, the batch was scaled; include a note on the PDF
    
    Returns:
        bytes — PDF file content
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "BatchSheetTitle",
        parent=styles["Title"],
        fontSize=20,
        spaceAfter=1 * mm,
        textColor=colors.HexColor("#1a1a2e"),
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=11,
        textColor=colors.HexColor("#4a4a6a"),
        spaceBefore=4 * mm,
        spaceAfter=2 * mm,
    )
    normal_style = ParagraphStyle(
        "NormalCustom",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
    )
    bold_style = ParagraphStyle(
        "BoldCustom",
        parent=normal_style,
        fontName="Helvetica-Bold",
    )

    elements = []

    # ── Header ─────────────────────────────────────────────────────────
    elements.append(Paragraph("Production Batch Sheet", title_style))
    elements.append(Paragraph("Formula & Compounding Instructions", normal_style))
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor("#e0e0e0"), spaceAfter=4 * mm
    ))

    # ── Product Info ───────────────────────────────────────────────────
    elements.append(Paragraph(f"<b>Product Name:</b> {product.get('name', '—')}", normal_style))

    batch_size_val = product.get('batch_size', '—')
    batch_unit_val = product.get('batch_unit', '')
    if original_batch_size is not None:
        # This is a scaled batch sheet
        elements.append(Paragraph(
            f"<b>Batch Size (This Run):</b> {batch_size_val} {batch_unit_val} "
            f"— <i>SCALED from {original_batch_size} {batch_unit_val} standard batch</i>",
            ParagraphStyle("ScaledNote", parent=normal_style,
                           textColor=colors.HexColor("#6c63ff"))
        ))
    else:
        elements.append(Paragraph(
            f"<b>Standard Batch Size:</b> {batch_size_val} {batch_unit_val}",
            normal_style
        ))
    elements.append(Spacer(1, 6 * mm))

    # ── Ingredients Table ──────────────────────────────────────────────
    elements.append(Paragraph("Formula Components", heading_style))
    
    table_data = [["#", "Raw Material", "Quantity", "Unit", "Check (✔)"]]
    total_qty = 0.0
    for i, line in enumerate(formula_lines, 1):
        qty = float(line.get("qty_per_batch", 0))
        total_qty += qty
        table_data.append([
            str(i),
            line.get("raw_material_name", "—"),
            str(qty),
            line.get("unit", ""),
            "[   ]"  # Space for workers to check off as they add
        ])

    # Add total row
    table_data.append(["", "TOTAL BATCH WEIGHT", f"{total_qty:,.3f}", "", ""])

    formula_table = Table(table_data, colWidths=["8%", "42%", "15%", "15%", "20%"])
    formula_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d3436")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Total row
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f2f6")),
        # Data rows
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 1), (0, -2), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "RIGHT"),
        ("ALIGN", (4, 1), (4, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dcdde1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(formula_table)
    elements.append(Spacer(1, 10 * mm))

    # ── Production Log Section ─────────────────────────────────────────
    elements.append(Paragraph("Production Controls", heading_style))
    
    controls_data = [
        ["Batch No:", "____________________", "Date:", "____________________"],
        ["Prepared By:", "____________________", "Checked By:", "____________________"],
        ["Manufacturing Start:", "____________________", "End Time:", "____________________"],
    ]
    controls_table = Table(controls_data, colWidths=["20%", "30%", "20%", "30%"])
    controls_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(controls_table)
    elements.append(Spacer(1, 10 * mm))

    # ── Observations / Notes ──────────────────────────────────────────
    elements.append(Paragraph("Observations / Remarks", heading_style))
    elements.append(Spacer(1, 2 * mm))
    
    # Empty box for notes
    notes_data = [[" "]]
    notes_table = Table(notes_data, colWidths=["100%"], rowHeights=[30 * mm])
    notes_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dcdde1")),
    ]))
    elements.append(notes_table)

    # ── Footer ─────────────────────────────────────────────────────────
    elements.append(Spacer(1, 15 * mm))
    elements.append(Paragraph(
        "Confidential Property of Flavour & Essence — For Internal Use Only",
        ParagraphStyle("Footer", parent=normal_style, alignment=TA_CENTER,
                       textColor=colors.HexColor("#a4b0be"), fontSize=8)
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
