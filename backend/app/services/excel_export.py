import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_session_excel(session_data: dict) -> bytes:
    """
    Generates a professionally formatted, multi-sheet Excel file (.xlsx)
    containing complete portfolio analysis information for a session.
    """
    wb = Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Styles
    navy_header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    sub_header_fill = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    
    title_font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    body_font = Font(name="Calibri", size=10, color="000000")
    meta_label_font = Font(name="Calibri", size=11, bold=True, color="1F4E78")
    meta_val_font = Font(name="Calibri", size=11, color="333333")

    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    header_border = Border(
        left=Side(style='thin', color='FFFFFF'),
        right=Side(style='thin', color='FFFFFF'),
        top=Side(style='medium', color='1F4E78'),
        bottom=Side(style='medium', color='1F4E78')
    )

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
    align_center_top = Alignment(horizontal="center", vertical="top", wrap_text=True)
    align_left_meta = Alignment(horizontal="left", vertical="center")

    patents = session_data.get("patents", [])

    # ---------------------------------------------------------
    # 1. SUMMARY SHEET
    # ---------------------------------------------------------
    ws_summary = wb.create_sheet(title="Summary")
    ws_summary.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_summary.merge_cells("A1:E2")
    title_cell = ws_summary["A1"]
    title_cell.value = "PORTFOLIO ANALYSIS SUMMARY REPORT"
    title_cell.font = title_font
    title_cell.fill = navy_header_fill
    title_cell.alignment = align_center

    # Metadata Block
    meta_items = [
        ("Session Name:", session_data.get("name", "N/A")),
        ("Session ID:", session_data.get("id", "N/A")),
        ("Status:", str(session_data.get("status", "N/A")).upper()),
        ("Total Patents:", str(session_data.get("total_patents", 0))),
        ("Processed Patents:", str(session_data.get("processed_patents", 0))),
        ("Export Date:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    ]

    for idx, (label, val) in enumerate(meta_items, start=4):
        lbl_cell = ws_summary.cell(row=idx, column=1, value=label)
        lbl_cell.font = meta_label_font
        lbl_cell.alignment = align_left_meta
        
        val_cell = ws_summary.cell(row=idx, column=2, value=val)
        val_cell.font = meta_val_font
        val_cell.alignment = align_left_meta

    # Overview Table Header
    start_row = 11
    ws_summary.cell(row=start_row - 1, column=1, value="Patents Overview").font = Font(name="Calibri", size=13, bold=True, color="1F4E78")
    
    sum_headers = ["Patent Number", "Title", "Assignee(s)", "Status", "Standard Info"]
    for col_num, h_text in enumerate(sum_headers, 1):
        cell = ws_summary.cell(row=start_row, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = sub_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_summary.row_dimensions[start_row].height = 24

    for row_idx, p in enumerate(patents, start=start_row + 1):
        assignees = p.get("assignees") or []
        if isinstance(assignees, list):
            assignees_str = ", ".join(assignees) if assignees else p.get("assignee", "Unknown")
        else:
            assignees_str = str(assignees)
        
        row_cells = [
            ws_summary.cell(row=row_idx, column=1, value=p.get("patent_number", "")),
            ws_summary.cell(row=row_idx, column=2, value=p.get("title", "")),
            ws_summary.cell(row=row_idx, column=3, value=assignees_str),
            ws_summary.cell(row=row_idx, column=4, value=p.get("status", "")),
            ws_summary.cell(row=row_idx, column=5, value=p.get("standard", "No Standard Found"))
        ]
        
        is_even = (row_idx - start_row) % 2 == 0
        for c in row_cells:
            c.font = body_font
            c.border = thin_border
            c.alignment = align_left
            if is_even:
                c.fill = alt_row_fill
        row_cells[0].alignment = align_center_top
        row_cells[3].alignment = align_center_top

    # ---------------------------------------------------------
    # 2. PATENT DETAILS SHEET
    # ---------------------------------------------------------
    ws_patents = wb.create_sheet(title="Patent Details")
    ws_patents.views.sheetView[0].showGridLines = True
    ws_patents.freeze_panes = "A2"

    pat_headers = [
        "Patent Number", "Title", "Assignees", "Abstract", 
        "Standard", "Standard Links", "Processing Status", "Error Message"
    ]
    
    for col_num, h_text in enumerate(pat_headers, 1):
        cell = ws_patents.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_patents.row_dimensions[1].height = 26

    for r_idx, p in enumerate(patents, start=2):
        assignees = p.get("assignees") or []
        if isinstance(assignees, list):
            assignees_str = "\n".join(assignees) if assignees else p.get("assignee", "Unknown")
        else:
            assignees_str = str(assignees)
        
        std_links = p.get("standard_links") or []
        std_links_str = "\n".join(std_links) if isinstance(std_links, list) else str(std_links)

        row_vals = [
            p.get("patent_number", ""),
            p.get("title", ""),
            assignees_str,
            p.get("abstract", ""),
            p.get("standard", ""),
            std_links_str,
            p.get("status", ""),
            p.get("error_message", "") or ""
        ]
        
        is_even = r_idx % 2 == 0
        for col_idx, val in enumerate(row_vals, start=1):
            c = ws_patents.cell(row=r_idx, column=col_idx, value=val)
            c.font = body_font
            c.border = thin_border
            c.alignment = align_left
            if is_even:
                c.fill = alt_row_fill
            if col_idx in [1, 7]:
                c.alignment = align_center_top

    # ---------------------------------------------------------
    # 3. TAXONOMY BREAKDOWN SHEET
    # ---------------------------------------------------------
    ws_tax = wb.create_sheet(title="Taxonomy Breakdown")
    ws_tax.views.sheetView[0].showGridLines = True
    ws_tax.freeze_panes = "A2"

    tax_headers = ["Subject Patent Number", "Patent Title", "Application Domain", "Technology Topic", "Granular Sub-Topic"]
    for col_num, h_text in enumerate(tax_headers, 1):
        cell = ws_tax.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_tax.row_dimensions[1].height = 26

    curr_row = 2
    for p in patents:
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")
        taxonomies = p.get("taxonomies") or []
        
        if not taxonomies:
            c_num = ws_tax.cell(row=curr_row, column=1, value=pat_num)
            c_ttl = ws_tax.cell(row=curr_row, column=2, value=pat_title)
            c_dom = ws_tax.cell(row=curr_row, column=3, value="N/A")
            c_top = ws_tax.cell(row=curr_row, column=4, value="N/A")
            c_sub = ws_tax.cell(row=curr_row, column=5, value="N/A")
            for c in [c_num, c_ttl, c_dom, c_top, c_sub]:
                c.font = body_font
                c.border = thin_border
                c.alignment = align_left
            c_num.alignment = align_center_top
            curr_row += 1
        else:
            for item in taxonomies:
                # Support both key schemas ('domain'/'topic'/'subtopic' vs 'application_domain'/'technology_topic'/'granular_sub_topic')
                domain = item.get("domain") or item.get("application_domain") or ""
                topic = item.get("topic") or item.get("technology_topic") or ""
                subtopic = item.get("subtopic") or item.get("granular_sub_topic") or ""
                
                c_num = ws_tax.cell(row=curr_row, column=1, value=pat_num)
                c_ttl = ws_tax.cell(row=curr_row, column=2, value=pat_title)
                c_dom = ws_tax.cell(row=curr_row, column=3, value=domain)
                c_top = ws_tax.cell(row=curr_row, column=4, value=topic)
                c_sub = ws_tax.cell(row=curr_row, column=5, value=subtopic)
                
                is_even = curr_row % 2 == 0
                for c in [c_num, c_ttl, c_dom, c_top, c_sub]:
                    c.font = body_font
                    c.border = thin_border
                    c.alignment = align_left
                    if is_even:
                        c.fill = alt_row_fill
                c_num.alignment = align_center_top
                curr_row += 1

    # ---------------------------------------------------------
    # 4. CITATIONS SHEET (FORWARD & BACKWARD)
    # ---------------------------------------------------------
    ws_cite = wb.create_sheet(title="Citations")
    ws_cite.views.sheetView[0].showGridLines = True
    ws_cite.freeze_panes = "A2"

    cite_headers = [
        "Subject Patent Number", "Direction", "Citation Patent Number", 
        "Citation Title", "Publication Date", "Citation Assignee(s)"
    ]
    for col_num, h_text in enumerate(cite_headers, 1):
        cell = ws_cite.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_cite.row_dimensions[1].height = 26

    curr_row = 2
    for p in patents:
        pat_num = p.get("patent_number", "")
        
        fwd = p.get("forward_citations") or []
        bwd = p.get("backward_citations") or []
        
        all_citations = []
        for item in fwd:
            all_citations.append(("Forward", item))
        for item in bwd:
            all_citations.append(("Backward", item))
            
        for direction, cite in all_citations:
            c_pat = cite.get("patent_number", "")
            c_ttl = cite.get("title", "")
            c_date = cite.get("publication_date", "")
            
            c_assignees = cite.get("assignees") or []
            if isinstance(c_assignees, list):
                c_assignees_str = ", ".join(c_assignees) if c_assignees else cite.get("assignee", "Unknown")
            else:
                c_assignees_str = str(c_assignees)

            c_subj = ws_cite.cell(row=curr_row, column=1, value=pat_num)
            c_dir = ws_cite.cell(row=curr_row, column=2, value=direction)
            c_cnum = ws_cite.cell(row=curr_row, column=3, value=c_pat)
            c_cttl = ws_cite.cell(row=curr_row, column=4, value=c_ttl)
            c_cdate = ws_cite.cell(row=curr_row, column=5, value=c_date)
            c_cass = ws_cite.cell(row=curr_row, column=6, value=c_assignees_str)
            
            is_even = curr_row % 2 == 0
            for c in [c_subj, c_dir, c_cnum, c_cttl, c_cdate, c_cass]:
                c.font = body_font
                c.border = thin_border
                c.alignment = align_left
                if is_even:
                    c.fill = alt_row_fill
            c_subj.alignment = align_center_top
            c_dir.alignment = align_center_top
            c_cnum.alignment = align_center_top
            c_cdate.alignment = align_center_top
            
            curr_row += 1

    # ---------------------------------------------------------
    # 5. COMPETITORS SHEET
    # ---------------------------------------------------------
    ws_comp = wb.create_sheet(title="Competitors")
    ws_comp.views.sheetView[0].showGridLines = True
    ws_comp.freeze_panes = "A2"

    comp_headers = ["Subject Patent Number", "Subject Patent Title", "Competitor Name"]
    for col_num, h_text in enumerate(comp_headers, 1):
        cell = ws_comp.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_comp.row_dimensions[1].height = 26

    curr_row = 2
    for p in patents:
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")
        comps = p.get("competitors") or []
        
        for comp in comps:
            comp_name = comp if isinstance(comp, str) else comp.get("name", str(comp))
            c_subj = ws_comp.cell(row=curr_row, column=1, value=pat_num)
            c_ttl = ws_comp.cell(row=curr_row, column=2, value=pat_title)
            c_cname = ws_comp.cell(row=curr_row, column=3, value=comp_name)
            
            is_even = curr_row % 2 == 0
            for c in [c_subj, c_ttl, c_cname]:
                c.font = body_font
                c.border = thin_border
                c.alignment = align_left
                if is_even:
                    c.fill = alt_row_fill
            c_subj.alignment = align_center_top
            curr_row += 1

    # ---------------------------------------------------------
    # ADJUST COLUMN WIDTHS AUTOMATICALLY FOR ALL SHEETS
    # ---------------------------------------------------------
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            
            for cell in col:
                # Skip merged header cell length on summary sheet
                if ws.title == "Summary" and cell.row <= 2:
                    continue
                val = str(cell.value or "")
                lines = val.split("\n")
                line_len = max(len(l) for l in lines) if lines else 0
                max_len = max(max_len, line_len)
            
            # Set width bounds (min 15, max 60 for text fields)
            adjusted_width = min(max(max_len + 4, 15), 60)
            ws.column_dimensions[col_letter].width = adjusted_width

    # Write to memory buffer
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
