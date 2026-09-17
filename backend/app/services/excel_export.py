# import io
# from datetime import datetime
# from openpyxl import Workbook
# from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
# from openpyxl.utils import get_column_letter

# def generate_session_excel(session_data: dict) -> bytes:
#     """
#     Generates a professionally formatted, multi-sheet Excel file (.xlsx)
#     containing complete portfolio analysis information for a session.
#     """
#     wb = Workbook()
#     # Remove default sheet
#     wb.remove(wb.active)

#     # Styles
#     navy_header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
#     sub_header_fill = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")
#     alt_row_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    
#     title_font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
#     header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
#     body_font = Font(name="Calibri", size=10, color="000000")
#     meta_label_font = Font(name="Calibri", size=11, bold=True, color="1F4E78")
#     meta_val_font = Font(name="Calibri", size=11, color="333333")

#     thin_border = Border(
#         left=Side(style='thin', color='D9D9D9'),
#         right=Side(style='thin', color='D9D9D9'),
#         top=Side(style='thin', color='D9D9D9'),
#         bottom=Side(style='thin', color='D9D9D9')
#     )
    
#     header_border = Border(
#         left=Side(style='thin', color='FFFFFF'),
#         right=Side(style='thin', color='FFFFFF'),
#         top=Side(style='medium', color='1F4E78'),
#         bottom=Side(style='medium', color='1F4E78')
#     )

#     align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
#     align_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
#     align_center_top = Alignment(horizontal="center", vertical="top", wrap_text=True)
#     align_left_meta = Alignment(horizontal="left", vertical="center")

#     patents = session_data.get("patents", [])

#     # ---------------------------------------------------------
#     # 1. SUMMARY SHEET
#     # ---------------------------------------------------------
#     ws_summary = wb.create_sheet(title="Summary")
#     ws_summary.views.sheetView[0].showGridLines = True

#     # Title Banner
#     ws_summary.merge_cells("A1:E2")
#     title_cell = ws_summary["A1"]
#     title_cell.value = "PORTFOLIO ANALYSIS SUMMARY REPORT"
#     title_cell.font = title_font
#     title_cell.fill = navy_header_fill
#     title_cell.alignment = align_center

#     # Metadata Block
#     meta_items = [
#         ("Session Name:", session_data.get("name", "N/A")),
#         ("Session ID:", session_data.get("id", "N/A")),
#         ("Status:", str(session_data.get("status", "N/A")).upper()),
#         ("Total Patents:", str(session_data.get("total_patents", 0))),
#         ("Processed Patents:", str(session_data.get("processed_patents", 0))),
#         ("Export Date:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
#     ]

#     for idx, (label, val) in enumerate(meta_items, start=4):
#         lbl_cell = ws_summary.cell(row=idx, column=1, value=label)
#         lbl_cell.font = meta_label_font
#         lbl_cell.alignment = align_left_meta
        
#         val_cell = ws_summary.cell(row=idx, column=2, value=val)
#         val_cell.font = meta_val_font
#         val_cell.alignment = align_left_meta

#     # Overview Table Header
#     start_row = 11
#     ws_summary.cell(row=start_row - 1, column=1, value="Patents Overview").font = Font(name="Calibri", size=13, bold=True, color="1F4E78")
    
#     sum_headers = ["Patent Number", "Title", "Assignee(s)", "Status", "Standard Info"]
#     for col_num, h_text in enumerate(sum_headers, 1):
#         cell = ws_summary.cell(row=start_row, column=col_num, value=h_text)
#         cell.font = header_font
#         cell.fill = sub_header_fill
#         cell.alignment = align_center
#         cell.border = header_border
#     ws_summary.row_dimensions[start_row].height = 24

#     for row_idx, p in enumerate(patents, start=start_row + 1):
#         assignees = p.get("assignees") or []
#         if isinstance(assignees, list):
#             assignees_str = ", ".join(assignees) if assignees else p.get("assignee", "Unknown")
#         else:
#             assignees_str = str(assignees)
        
#         row_cells = [
#             ws_summary.cell(row=row_idx, column=1, value=p.get("patent_number", "")),
#             ws_summary.cell(row=row_idx, column=2, value=p.get("title", "")),
#             ws_summary.cell(row=row_idx, column=3, value=assignees_str),
#             ws_summary.cell(row=row_idx, column=4, value=p.get("status", "")),
#             ws_summary.cell(row=row_idx, column=5, value=p.get("standard", "No Standard Found"))
#         ]
        
#         is_even = (row_idx - start_row) % 2 == 0
#         for c in row_cells:
#             c.font = body_font
#             c.border = thin_border
#             c.alignment = align_left
#             if is_even:
#                 c.fill = alt_row_fill
#         row_cells[0].alignment = align_center_top
#         row_cells[3].alignment = align_center_top

#     # ---------------------------------------------------------
#     # 2. PATENT DETAILS SHEET
#     # ---------------------------------------------------------
#     ws_patents = wb.create_sheet(title="Patent Details")
#     ws_patents.views.sheetView[0].showGridLines = True
#     ws_patents.freeze_panes = "A2"

#     pat_headers = [
#         "Patent Number", "Title", "Assignees", "Abstract", 
#         "Standard", "Standard Links", "Processing Status", "Error Message"
#     ]
    
#     for col_num, h_text in enumerate(pat_headers, 1):
#         cell = ws_patents.cell(row=1, column=col_num, value=h_text)
#         cell.font = header_font
#         cell.fill = navy_header_fill
#         cell.alignment = align_center
#         cell.border = header_border
#     ws_patents.row_dimensions[1].height = 26

#     for r_idx, p in enumerate(patents, start=2):
#         assignees = p.get("assignees") or []
#         if isinstance(assignees, list):
#             assignees_str = "\n".join(assignees) if assignees else p.get("assignee", "Unknown")
#         else:
#             assignees_str = str(assignees)
        
#         std_links = p.get("standard_links") or []
#         std_links_str = "\n".join(std_links) if isinstance(std_links, list) else str(std_links)

#         row_vals = [
#             p.get("patent_number", ""),
#             p.get("title", ""),
#             assignees_str,
#             p.get("abstract", ""),
#             p.get("standard", ""),
#             std_links_str,
#             p.get("status", ""),
#             p.get("error_message", "") or ""
#         ]
        
#         is_even = r_idx % 2 == 0
#         for col_idx, val in enumerate(row_vals, start=1):
#             c = ws_patents.cell(row=r_idx, column=col_idx, value=val)
#             c.font = body_font
#             c.border = thin_border
#             c.alignment = align_left
#             if is_even:
#                 c.fill = alt_row_fill
#             if col_idx in [1, 7]:
#                 c.alignment = align_center_top

#     # ---------------------------------------------------------
#     # 3. TAXONOMY BREAKDOWN SHEET
#     # ---------------------------------------------------------
#     ws_tax = wb.create_sheet(title="Taxonomy Breakdown")
#     ws_tax.views.sheetView[0].showGridLines = True
#     ws_tax.freeze_panes = "A2"

#     tax_headers = ["Subject Patent Number", "Patent Title", "Application Domain", "Technology Topic", "Granular Sub-Topic"]
#     for col_num, h_text in enumerate(tax_headers, 1):
#         cell = ws_tax.cell(row=1, column=col_num, value=h_text)
#         cell.font = header_font
#         cell.fill = navy_header_fill
#         cell.alignment = align_center
#         cell.border = header_border
#     ws_tax.row_dimensions[1].height = 26

#     curr_row = 2
#     for p in patents:
#         pat_num = p.get("patent_number", "")
#         pat_title = p.get("title", "")
#         taxonomies = p.get("taxonomies") or []
        
#         if not taxonomies:
#             c_num = ws_tax.cell(row=curr_row, column=1, value=pat_num)
#             c_ttl = ws_tax.cell(row=curr_row, column=2, value=pat_title)
#             c_dom = ws_tax.cell(row=curr_row, column=3, value="N/A")
#             c_top = ws_tax.cell(row=curr_row, column=4, value="N/A")
#             c_sub = ws_tax.cell(row=curr_row, column=5, value="N/A")
#             for c in [c_num, c_ttl, c_dom, c_top, c_sub]:
#                 c.font = body_font
#                 c.border = thin_border
#                 c.alignment = align_left
#             c_num.alignment = align_center_top
#             curr_row += 1
#         else:
#             for item in taxonomies:
#                 # Support both key schemas ('domain'/'topic'/'subtopic' vs 'application_domain'/'technology_topic'/'granular_sub_topic')
#                 domain = item.get("domain") or item.get("application_domain") or ""
#                 topic = item.get("topic") or item.get("technology_topic") or ""
#                 subtopic = item.get("subtopic") or item.get("granular_sub_topic") or ""
                
#                 c_num = ws_tax.cell(row=curr_row, column=1, value=pat_num)
#                 c_ttl = ws_tax.cell(row=curr_row, column=2, value=pat_title)
#                 c_dom = ws_tax.cell(row=curr_row, column=3, value=domain)
#                 c_top = ws_tax.cell(row=curr_row, column=4, value=topic)
#                 c_sub = ws_tax.cell(row=curr_row, column=5, value=subtopic)
                
#                 is_even = curr_row % 2 == 0
#                 for c in [c_num, c_ttl, c_dom, c_top, c_sub]:
#                     c.font = body_font
#                     c.border = thin_border
#                     c.alignment = align_left
#                     if is_even:
#                         c.fill = alt_row_fill
#                 c_num.alignment = align_center_top
#                 curr_row += 1

#     # ---------------------------------------------------------
#     # 4. CITATIONS SHEET (FORWARD & BACKWARD)
#     # ---------------------------------------------------------
#     ws_cite = wb.create_sheet(title="Citations")
#     ws_cite.views.sheetView[0].showGridLines = True
#     ws_cite.freeze_panes = "A2"

#     cite_headers = [
#         "Subject Patent Number", "Direction", "Citation Patent Number", 
#         "Citation Title", "Publication Date", "Citation Assignee(s)"
#     ]
#     for col_num, h_text in enumerate(cite_headers, 1):
#         cell = ws_cite.cell(row=1, column=col_num, value=h_text)
#         cell.font = header_font
#         cell.fill = navy_header_fill
#         cell.alignment = align_center
#         cell.border = header_border
#     ws_cite.row_dimensions[1].height = 26

#     curr_row = 2
#     for p in patents:
#         pat_num = p.get("patent_number", "")
        
#         fwd = p.get("forward_citations") or []
#         bwd = p.get("backward_citations") or []
        
#         all_citations = []
#         for item in fwd:
#             all_citations.append(("Forward", item))
#         for item in bwd:
#             all_citations.append(("Backward", item))
            
#         for direction, cite in all_citations:
#             c_pat = cite.get("patent_number", "")
#             c_ttl = cite.get("title", "")
#             c_date = cite.get("publication_date", "")
            
#             c_assignees = cite.get("assignees") or []
#             if isinstance(c_assignees, list):
#                 c_assignees_str = ", ".join(c_assignees) if c_assignees else cite.get("assignee", "Unknown")
#             else:
#                 c_assignees_str = str(c_assignees)

#             c_subj = ws_cite.cell(row=curr_row, column=1, value=pat_num)
#             c_dir = ws_cite.cell(row=curr_row, column=2, value=direction)
#             c_cnum = ws_cite.cell(row=curr_row, column=3, value=c_pat)
#             c_cttl = ws_cite.cell(row=curr_row, column=4, value=c_ttl)
#             c_cdate = ws_cite.cell(row=curr_row, column=5, value=c_date)
#             c_cass = ws_cite.cell(row=curr_row, column=6, value=c_assignees_str)
            
#             is_even = curr_row % 2 == 0
#             for c in [c_subj, c_dir, c_cnum, c_cttl, c_cdate, c_cass]:
#                 c.font = body_font
#                 c.border = thin_border
#                 c.alignment = align_left
#                 if is_even:
#                     c.fill = alt_row_fill
#             c_subj.alignment = align_center_top
#             c_dir.alignment = align_center_top
#             c_cnum.alignment = align_center_top
#             c_cdate.alignment = align_center_top
            
#             curr_row += 1

#     # ---------------------------------------------------------
#     # 5. COMPETITORS SHEET
#     # ---------------------------------------------------------
#     ws_comp = wb.create_sheet(title="Competitors")
#     ws_comp.views.sheetView[0].showGridLines = True
#     ws_comp.freeze_panes = "A2"

#     comp_headers = ["Subject Patent Number", "Subject Patent Title", "Competitor Source / Category", "Competitor Name"]
#     for col_num, h_text in enumerate(comp_headers, 1):
#         cell = ws_comp.cell(row=1, column=col_num, value=h_text)
#         cell.font = header_font
#         cell.fill = navy_header_fill
#         cell.alignment = align_center
#         cell.border = header_border
#     ws_comp.row_dimensions[1].height = 26

#     curr_row = 2
#     for p in patents:
#         pat_num = p.get("patent_number", "")
#         pat_title = p.get("title", "")
        
#         fwd_comps = p.get("forward_competitors") or []
#         bwd_comps = p.get("backward_competitors") or []
        
#         comp_entries = []
#         for c in fwd_comps:
#             comp_entries.append(("Forward Citation Assignee", c))
#         for c in bwd_comps:
#             comp_entries.append(("Backward Citation Assignee", c))

#         for source, comp_name in comp_entries:
#             c_pnum = ws_comp.cell(row=curr_row, column=1, value=pat_num)
#             c_pttl = ws_comp.cell(row=curr_row, column=2, value=pat_title)
#             c_src = ws_comp.cell(row=curr_row, column=3, value=source)
#             c_cname = ws_comp.cell(row=curr_row, column=4, value=comp_name)
            
#             is_even = curr_row % 2 == 0
#             for c in [c_pnum, c_pttl, c_src, c_cname]:
#                 c.font = body_font
#                 c.border = thin_border
#                 c.alignment = align_left
#                 if is_even:
#                     c.fill = alt_row_fill
#             c_pnum.alignment = align_center_top
#             c_src.alignment = align_center_top
            
#             curr_row += 1

#     # ---------------------------------------------------------
#     # ADJUST COLUMN WIDTHS AUTOMATICALLY FOR ALL SHEETS
#     # ---------------------------------------------------------
#     for ws in wb.worksheets:
#         for col in ws.columns:
#             max_len = 0
#             col_letter = get_column_letter(col[0].column)
            
#             for cell in col:
#                 # Skip merged header cell length on summary sheet
#                 if ws.title == "Summary" and cell.row <= 2:
#                     continue
#                 val = str(cell.value or "")
#                 lines = val.split("\n")
#                 line_len = max(len(l) for l in lines) if lines else 0
#                 max_len = max(max_len, line_len)
            
#             # Set width bounds (min 15, max 60 for text fields)
#             adjusted_width = min(max(max_len + 4, 15), 60)
#             ws.column_dimensions[col_letter].width = adjusted_width

#     # Write to memory buffer
#     output = io.BytesIO()
#     wb.save(output)
#     output.seek(0)
#     return output.getvalue()


import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from .translator import batch_translate_names


def generate_session_excel(session_data: dict, db=None, translate: bool = False) -> bytes:
    """
    Generates a professionally formatted, multi-sheet Excel file (.xlsx)
    containing complete portfolio analysis information for a session.

    Taxonomy Breakdown, Citations, and Competitors sheets group each patent
    into a single visual block: Patent Number and Title are merged down the
    block, and the itemized detail (domain/topic/subtopic, forward/backward
    citations, forward/backward competitors) runs as aligned rows within it.
    """
    wb = Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    patents = session_data.get("patents", [])

    if translate and db:
        # --- Step 1: Aggregate ALL unique names from every field ---
        all_names = set()
        for p in patents:
            # Top-level patent assignees
            assignees = p.get("assignees") or []
            if isinstance(assignees, list):
                all_names.update(a for a in assignees if a)
            elif isinstance(assignees, str) and assignees:
                all_names.add(assignees)
                
            # Forward/Backward competitors
            all_names.update(c for c in (p.get("forward_competitors") or []) if c)
            all_names.update(c for c in (p.get("backward_competitors") or []) if c)

            # --- FIXED: Nested citation-level assignees ---
            for cite in (p.get("forward_citations") or []):
                for a in (cite.get("assignees") or []):
                    if a:
                        all_names.add(a)
            for cite in (p.get("backward_citations") or []):
                for a in (cite.get("assignees") or []):
                    if a:
                        all_names.add(a)
        
        # --- Step 2: Batch translate (with non-English filter inside translator) ---
        translation_map = batch_translate_names(db, list(all_names))
        
        # --- Step 3: Replace names in-memory across ALL fields ---
        for p in patents:
            # Top-level patent assignees
            assignees = p.get("assignees") or []
            if isinstance(assignees, list):
                p["assignees"] = [translation_map.get(a, a) for a in assignees]
            elif isinstance(assignees, str):
                p["assignees"] = translation_map.get(assignees, assignees)
                
            # Forward/Backward competitors
            fwd_comps = p.get("forward_competitors") or []
            if isinstance(fwd_comps, list):
                p["forward_competitors"] = [translation_map.get(c, c) for c in fwd_comps]
                
            bwd_comps = p.get("backward_competitors") or []
            if isinstance(bwd_comps, list):
                p["backward_competitors"] = [translation_map.get(c, c) for c in bwd_comps]

            # --- FIXED: Replace nested citation-level assignees ---
            for cite in (p.get("forward_citations") or []):
                cite_assignees = cite.get("assignees") or []
                if isinstance(cite_assignees, list):
                    cite["assignees"] = [translation_map.get(a, a) for a in cite_assignees]

            for cite in (p.get("backward_citations") or []):
                cite_assignees = cite.get("assignees") or []
                if isinstance(cite_assignees, list):
                    cite["assignees"] = [translation_map.get(a, a) for a in cite_assignees]


    # ---------------------------------------------------------
    # Styles
    # ---------------------------------------------------------
    navy_header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    sub_header_fill = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")
    fwd_header_fill = PatternFill(start_color="2E6E4E", end_color="2E6E4E", fill_type="solid")
    bwd_header_fill = PatternFill(start_color="8C3A3A", end_color="8C3A3A", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    block_fill_a = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    block_fill_b = PatternFill(start_color="EEF3F9", end_color="EEF3F9", fill_type="solid")

    title_font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    body_font = Font(name="Calibri", size=10, color="000000")
    block_anchor_font = Font(name="Calibri", size=10, bold=True, color="000000")
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

    # Thicker bottom border used to close off each patent's block
    block_close_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='medium', color='1F4E78')
    )

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
    align_center_top = Alignment(horizontal="center", vertical="top", wrap_text=True)
    align_left_meta = Alignment(horizontal="left", vertical="center")
    align_center_mid = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left_mid = Alignment(horizontal="left", vertical="center", wrap_text=True)

    patents = session_data.get("patents", [])

    def get_assignees_str(assignees, fallback_key_obj, sep=", "):
        if isinstance(assignees, list):
            return sep.join(assignees) if assignees else fallback_key_obj.get("assignee", "Unknown")
        return str(assignees) if assignees else fallback_key_obj.get("assignee", "Unknown")

    def merge_repeated_vertical(ws, col, start_row, end_row, key_fn=None):
        """
        Within rows [start_row, end_row] of a single column, merge any run of
        consecutive cells that share the same value (or the same key, if
        key_fn is given — used so Topic only merges within a matching Domain
        run, not across a Domain boundary where the topic text happens to
        repeat). Clears the value from the covered-but-not-top cells so the
        merge doesn't carry duplicate underlying data.
        """
        run_start = start_row
        run_key = key_fn(start_row) if key_fn else ws.cell(row=start_row, column=col).value
        for r in range(start_row + 1, end_row + 2):  # +1 sentinel row to flush final run
            cur_key = key_fn(r) if (key_fn and r <= end_row) else (
                ws.cell(row=r, column=col).value if r <= end_row else object())
            if r <= end_row and cur_key == run_key:
                continue
            if r - 1 > run_start:
                for rr in range(run_start + 1, r):
                    ws.cell(row=rr, column=col).value = None
                ws.merge_cells(start_row=run_start, start_column=col, end_row=r - 1, end_column=col)
            if r <= end_row:
                run_start = r
                run_key = cur_key

    # ---------------------------------------------------------
    # 1. SUMMARY SHEET  (unchanged — one row per patent overview)
    # ---------------------------------------------------------
    ws_summary = wb.create_sheet(title="Summary")
    ws_summary.views.sheetView[0].showGridLines = True

    ws_summary.merge_cells("A1:E2")
    title_cell = ws_summary["A1"]
    title_cell.value = "PORTFOLIO ANALYSIS SUMMARY REPORT"
    title_cell.font = title_font
    title_cell.fill = navy_header_fill
    title_cell.alignment = align_center

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

    start_row = 11
    ws_summary.cell(row=start_row - 1, column=1, value="Patents Overview").font = Font(
        name="Calibri", size=13, bold=True, color="1F4E78")

    sum_headers = ["Patent Number", "Title", "Assignee(s)", "Status", "Standard Info"]
    for col_num, h_text in enumerate(sum_headers, 1):
        cell = ws_summary.cell(row=start_row, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = sub_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_summary.row_dimensions[start_row].height = 24

    for row_idx, p in enumerate(patents, start=start_row + 1):
        assignees_str = get_assignees_str(p.get("assignees") or [], p)

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
    # 2. PATENT DETAILS SHEET  (unchanged — one row per patent)
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
        assignees_str = get_assignees_str(p.get("assignees") or [], p, sep="\n")

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
    #    One merged block per patent (Patent Number + Title merged down
    #    the block); one sub-row per Domain > Topic > Sub-topic combination.
    # ---------------------------------------------------------
    ws_tax = wb.create_sheet(title="Taxonomy Breakdown")
    ws_tax.views.sheetView[0].showGridLines = True
    ws_tax.freeze_panes = "A2"

    tax_headers = ["Patent Number", "Title", "Application Domain", "Technology Topic", "Granular Sub-Topic"]
    for col_num, h_text in enumerate(tax_headers, 1):
        cell = ws_tax.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_tax.row_dimensions[1].height = 26

    curr_row = 2
    for p_idx, p in enumerate(patents):
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")
        taxonomies = p.get("taxonomies") or []

        rows_for_block = []
        for item in taxonomies:
            domain = item.get("domain") or item.get("application_domain") or "General"
            topic = item.get("topic") or item.get("technology_topic") or "General Topic"
            subtopic = item.get("subtopic") or item.get("granular_sub_topic") or "N/A"
            rows_for_block.append((domain, topic, subtopic))
        if not rows_for_block:
            rows_for_block = [("N/A", "N/A", "N/A")]

        start_r = curr_row
        block_fill = block_fill_b if p_idx % 2 else block_fill_a
        for domain, topic, subtopic in rows_for_block:
            c_dom = ws_tax.cell(row=curr_row, column=3, value=domain)
            c_top = ws_tax.cell(row=curr_row, column=4, value=topic)
            c_sub = ws_tax.cell(row=curr_row, column=5, value=subtopic)
            for c in [c_dom, c_top, c_sub]:
                c.font = body_font
                c.border = thin_border
                c.alignment = align_left_mid
                c.fill = block_fill
            curr_row += 1
        end_r = curr_row - 1

        # Merge Patent Number / Title down the block
        if end_r > start_r:
            ws_tax.merge_cells(start_row=start_r, start_column=1, end_row=end_r, end_column=1)
            ws_tax.merge_cells(start_row=start_r, start_column=2, end_row=end_r, end_column=2)
        anchor_num = ws_tax.cell(row=start_r, column=1, value=pat_num)
        anchor_ttl = ws_tax.cell(row=start_r, column=2, value=pat_title)
        anchor_num.font = block_anchor_font
        anchor_ttl.font = body_font
        anchor_num.alignment = align_center_mid
        anchor_ttl.alignment = align_left_mid
        for r in range(start_r, end_r + 1):
            for col in (1, 2):
                ws_tax.cell(row=r, column=col).fill = block_fill
                ws_tax.cell(row=r, column=col).border = thin_border

        # Collapse repeated Domain / Topic values within this patent's block
        # so they don't repeat on every Sub-topic row — same idea as merging
        # Patent Number/Title, applied one level deeper. Keyed off the
        # original (domain, topic) data, not the worksheet cells — merging
        # Domain first would clear the covered cells' values, so reading
        # them back afterward for the Topic key would see None instead of
        # the real domain.
        if end_r > start_r:
            merge_repeated_vertical(ws_tax, col=3, start_row=start_r, end_row=end_r)
            merge_repeated_vertical(
                ws_tax, col=4, start_row=start_r, end_row=end_r,
                key_fn=lambda r: (rows_for_block[r - start_r][0], rows_for_block[r - start_r][1])
            )
            for r in range(start_r, end_r + 1):
                for col in (3, 4):
                    ws_tax.cell(row=r, column=col).alignment = align_left_mid

        # thicker separator line under the block
        for col in range(1, 6):
            ws_tax.cell(row=end_r, column=col).border = block_close_border

    # ---------------------------------------------------------
    # 4. CITATIONS SHEET
    #    One merged block per patent; Forward Citation No./Assignee and
    #    Backward Citation No./Assignee run side by side, row-aligned by
    #    index (dash where one side runs out).
    # ---------------------------------------------------------
    ws_cite = wb.create_sheet(title="Citations")
    ws_cite.views.sheetView[0].showGridLines = True
    ws_cite.freeze_panes = "A2"

    cite_headers = [
        "Patent Number", "Title",
        "Forward Citation No.", "Forward Citation Assignee",
        "Backward Citation No.", "Backward Citation Assignee",
    ]
    for col_num, h_text in enumerate(cite_headers, 1):
        cell = ws_cite.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = fwd_header_fill if col_num in (3, 4) else (
            bwd_header_fill if col_num in (5, 6) else navy_header_fill)
        cell.alignment = align_center
        cell.border = header_border
    ws_cite.row_dimensions[1].height = 26

    curr_row = 2
    for p_idx, p in enumerate(patents):
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")

        fwd = p.get("forward_citations") or []
        bwd = p.get("backward_citations") or []

        def cite_pair(cite):
            c_pat = cite.get("patent_number", "")
            c_assignees_str = get_assignees_str(cite.get("assignees") or [], cite)
            return c_pat, c_assignees_str

        fwd_pairs = [cite_pair(c) for c in fwd]
        bwd_pairs = [cite_pair(c) for c in bwd]

        # Join all citations into a single comma-separated string
        fnum_str = ", ".join([f[0] for f in fwd_pairs if f[0]]) or "—"
        fass_str = ", ".join([f[1] for f in fwd_pairs if f[1]]) or "—"
        bnum_str = ", ".join([b[0] for b in bwd_pairs if b[0]]) or "—"
        bass_str = ", ".join([b[1] for b in bwd_pairs if b[1]]) or "—"

        block_fill = block_fill_b if p_idx % 2 else block_fill_a

        c_pnum = ws_cite.cell(row=curr_row, column=1, value=pat_num)
        c_pttl = ws_cite.cell(row=curr_row, column=2, value=pat_title)
        c_fnum = ws_cite.cell(row=curr_row, column=3, value=fnum_str)
        c_fass = ws_cite.cell(row=curr_row, column=4, value=fass_str)
        c_bnum = ws_cite.cell(row=curr_row, column=5, value=bnum_str)
        c_bass = ws_cite.cell(row=curr_row, column=6, value=bass_str)

        for c, align in [(c_pnum, align_center_mid), (c_pttl, align_left_mid),
                         (c_fnum, align_center_mid), (c_fass, align_left_mid),
                         (c_bnum, align_center_mid), (c_bass, align_left_mid)]:
            c.font = body_font
            c.border = block_close_border
            c.alignment = align
            c.fill = block_fill

        curr_row += 1

    # ---------------------------------------------------------
    # 5. COMPETITORS SHEET
    #    One merged block per patent; Forward Competitor and Backward
    #    Competitor run side by side, one name per row.
    # ---------------------------------------------------------
    ws_comp = wb.create_sheet(title="Competitors")
    ws_comp.views.sheetView[0].showGridLines = True
    ws_comp.freeze_panes = "A2"

    comp_headers = ["Patent Number", "Title", "Forward Competitor", "Backward Competitor"]
    for col_num, h_text in enumerate(comp_headers, 1):
        cell = ws_comp.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = fwd_header_fill if col_num == 3 else (
            bwd_header_fill if col_num == 4 else navy_header_fill)
        cell.alignment = align_center
        cell.border = header_border
    ws_comp.row_dimensions[1].height = 26

    curr_row = 2
    for p_idx, p in enumerate(patents):
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")

        fwd_comps = p.get("forward_competitors") or []
        bwd_comps = p.get("backward_competitors") or []

        # Join all competitors into a single comma-separated string
        fname_str = ", ".join([c for c in fwd_comps if c]) or "—"
        bname_str = ", ".join([c for c in bwd_comps if c]) or "—"

        block_fill = block_fill_b if p_idx % 2 else block_fill_a

        c_pnum = ws_comp.cell(row=curr_row, column=1, value=pat_num)
        c_pttl = ws_comp.cell(row=curr_row, column=2, value=pat_title)
        c_fname = ws_comp.cell(row=curr_row, column=3, value=fname_str)
        c_bname = ws_comp.cell(row=curr_row, column=4, value=bname_str)

        for c, align in [(c_pnum, align_center_mid), (c_pttl, align_left_mid),
                         (c_fname, align_left_mid), (c_bname, align_left_mid)]:
            c.font = body_font
            c.border = block_close_border
            c.alignment = align
            c.fill = block_fill

        curr_row += 1

    # ---------------------------------------------------------
    # 6. RANKED ASSIGNEES SHEET
    # ---------------------------------------------------------
    ws_ranked = wb.create_sheet(title="Ranked Assignees")
    ws_ranked.views.sheetView[0].showGridLines = True
    ws_ranked.freeze_panes = "A2"

    ranked_headers = [
        "Patent Number", "Title", "Assignee", 
        "Topic Score", "Topic Reason", "Topic Source",
        "Subtopic Score", "Subtopic Reason", "Subtopic Source"
    ]
    for col_num, h_text in enumerate(ranked_headers, 1):
        cell = ws_ranked.cell(row=1, column=col_num, value=h_text)
        cell.font = header_font
        cell.fill = navy_header_fill
        cell.alignment = align_center
        cell.border = header_border
    ws_ranked.row_dimensions[1].height = 26

    curr_row = 2
    for p_idx, p in enumerate(patents):
        pat_num = p.get("patent_number", "")
        pat_title = p.get("title", "")
        
        ranked_assignees = p.get("ranked_forward_assignees") or []
        block_fill = block_fill_b if p_idx % 2 else block_fill_a
        
        if not ranked_assignees:
            # Add an empty row for patents with no ranked assignees
            for col_idx, val in enumerate([pat_num, pat_title, "—", "—", "—", "—", "—", "—", "—"], start=1):
                c = ws_ranked.cell(row=curr_row, column=col_idx, value=val)
                c.font = body_font
                c.border = block_close_border
                c.alignment = align_center_mid if col_idx in (1, 4, 7) else align_left_mid
                c.fill = block_fill
            curr_row += 1
            continue
            
        assignee_names = []
        all_t_scores = []
        all_t_reasons = []
        all_t_sources = []
        all_s_scores = []
        all_s_reasons = []
        all_s_sources = []
        
        for ra in ranked_assignees:
            a_name = ra.get("name", "")
            assignee_names.append(a_name)
            
            t_evals = ra.get("topic_evals", [])
            if not t_evals and "topic_eval" in ra: t_evals = [ra.get("topic_eval")]
            s_evals = ra.get("subtopic_evals", [])
            if not s_evals and "subtopic_eval" in ra: s_evals = [ra.get("subtopic_eval")]
            
            t_scores = "\n".join(f"{e.get('term', 'Topic')}: {e.get('score', '')}" for e in t_evals if e)
            t_reasons = "\n\n".join(f"{e.get('term', 'Topic')}:\n{e.get('reason', '')}" for e in t_evals if e)
            t_sources = "\n".join(f"{e.get('source', '')}" for e in t_evals if e)
            
            s_scores = "\n".join(f"{e.get('term', 'Subtopic')}: {e.get('score', '')}" for e in s_evals if e)
            s_reasons = "\n\n".join(f"{e.get('term', 'Subtopic')}:\n{e.get('reason', '')}" for e in s_evals if e)
            s_sources = "\n".join(f"{e.get('source', '')}" for e in s_evals if e)
            
            prefix = f"[{a_name}]\n" if len(ranked_assignees) > 1 else ""
            
            all_t_scores.append(f"{prefix}{t_scores}")
            all_t_reasons.append(f"{prefix}{t_reasons}")
            all_t_sources.append(f"{prefix}{t_sources}")
            all_s_scores.append(f"{prefix}{s_scores}")
            all_s_reasons.append(f"{prefix}{s_reasons}")
            all_s_sources.append(f"{prefix}{s_sources}")
            
        row_vals = [
            pat_num, 
            pat_title, 
            "\n\n".join(assignee_names),
            "\n\n---\n\n".join(all_t_scores),
            "\n\n---\n\n".join(all_t_reasons),
            "\n\n---\n\n".join(all_t_sources),
            "\n\n---\n\n".join(all_s_scores),
            "\n\n---\n\n".join(all_s_reasons),
            "\n\n---\n\n".join(all_s_sources)
        ]
        
        for col_idx, val in enumerate(row_vals, start=1):
            c = ws_ranked.cell(row=curr_row, column=col_idx, value=val)
            c.font = body_font
            c.border = block_close_border
            c.alignment = align_center_mid if col_idx in (1, 4, 7) else align_left_mid
            c.fill = block_fill
            
        curr_row += 1

    # ---------------------------------------------------------
    # 7. KYP ANALYSIS SHEET
    # ---------------------------------------------------------
    ws_kyp = wb.create_sheet(title="KYP Analysis")
    ws_kyp.views.sheetView[0].showGridLines = True
    ws_kyp.freeze_panes = "A3"
    
    kyp_red = PatternFill(start_color="C0504D", end_color="C0504D", fill_type="solid")
    kyp_yellow = PatternFill(start_color="FFC000", end_color="FFC000", fill_type="solid")
    kyp_orange = PatternFill(start_color="F79646", end_color="F79646", fill_type="solid")
    kyp_teal = PatternFill(start_color="4BACC6", end_color="4BACC6", fill_type="solid")
    kyp_blue = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
    kyp_gold = PatternFill(start_color="FFC000", end_color="FFC000", fill_type="solid")
    kyp_cit_orange = PatternFill(start_color="F79646", end_color="F79646", fill_type="solid")
    kyp_green = PatternFill(start_color="9BBB59", end_color="9BBB59", fill_type="solid")
    
    super_headers = [
        ("Patent Analysis", 1, 3, kyp_red),
        ("Bibliographic Details", 4, 10, kyp_yellow),
        ("Technology in trend", 11, 12, kyp_orange),
        ("Novelty of patent", 13, 15, kyp_teal),
        ("Doc Family Stats", 16, 17, kyp_blue),
        ("Legal Actions", 18, 18, kyp_gold),
        ("Citations", 19, 20, kyp_cit_orange),
        ("Parameters Score", 21, 30, kyp_green)
    ]
    
    for title_text, start_col, end_col, fill in super_headers:
        ws_kyp.merge_cells(start_row=1, start_column=start_col, end_row=1, end_column=end_col)
        cell = ws_kyp.cell(row=1, column=start_col, value=title_text)
        cell.font = Font(name="Calibri", size=14, bold=True, color="000000")
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for col_idx in range(start_col, end_col + 1):
            ws_kyp.cell(row=1, column=col_idx).border = header_border

    kyp_sub_headers = [
        ("Rank", kyp_red), ("Patent Number", kyp_red), ("Total Score", kyp_red),
        ("Title", kyp_yellow), ("Priority Date", kyp_yellow), ("Expiry Date", kyp_yellow), 
        ("Legal Status", kyp_yellow), ("Patent Life Span", kyp_yellow), 
        ("Classifications", kyp_yellow), ("Inventors", kyp_yellow),
        ("Active Similar Docs", kyp_orange), ("Is Foward Citations Increasing Yearly", kyp_orange),
        ("Independant Claim Min Length", kyp_teal), ("Count 101 Rej", kyp_teal), ("Rejections on Novelty", kyp_teal),
        ("Patent Family Count", kyp_blue), ("Family Active Stats", kyp_blue),
        ("PTAB Records", kyp_gold),
        ("Forward/Backward Citation Ratio", kyp_cit_orange), ("NPL Citations", kyp_cit_orange),
        ("Legal Status Score", kyp_green), ("Family Score", kyp_green), ("Shortest Ic Score", kyp_green), 
        ("Age Score", kyp_green), ("Forward/Backward Citation Ratio Score", kyp_green), 
        ("Is Foward Citations Increasing Yearly Score", kyp_green), ("Count of Rejections on Novelty Score", kyp_green), 
        ("PTAB Records Score", kyp_green), ("Active Similar Docs Score", kyp_green), ("Family Active Stats Score", kyp_green)
    ]

    for col_idx, (h_text, fill) in enumerate(kyp_sub_headers, 1):
        cell = ws_kyp.cell(row=2, column=col_idx, value=h_text)
        cell.font = Font(name="Calibri", size=11, bold=True)
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws_kyp.row_dimensions[1].height = 30
    ws_kyp.row_dimensions[2].height = 50

    curr_row = 3
    for p_idx, p in enumerate(patents):
        kyp_data = p.get("kyp_score_data") or {}
        kyp_classifications = p.get("kyp_classifications") or []
        kyp_class_str = ", ".join([c.get('code', '') for c in kyp_classifications])
        
        def format_score(field):
            val = kyp_data.get(field)
            if val is None:
                return "0/5"
            return str(val) if "/" in str(val) else f"{val}/5"

        row_vals = [
            p_idx + 1,
            p.get("patent_number", ""),
            f"{p.get('kyp_score', 0)}/100" if p.get("kyp_score") is not None else "0/100",
            p.get("title", ""),
            kyp_data.get("priority_date", "N/A"),
            kyp_data.get("expiry_date", "N/A"),
            kyp_data.get("legal_status", "N/A"),
            kyp_data.get("patent_life_span", "N/A"),
            kyp_class_str,
            kyp_data.get("inventors", "N/A"),
            
            kyp_data.get("active_similar_docs", 0),
            "TRUE" if kyp_data.get("is_foward_citations_increasing_yearly") else "FALSE",
            
            kyp_data.get("independant_claim_min_length", 0),
            kyp_data.get("count_101_rej", 0),
            kyp_data.get("count_of_rejections_on_novelty", 0),
            
            kyp_data.get("patent_family_count", 0),
            kyp_data.get("family_active_stats", 0),
            
            kyp_data.get("PTAB_records", 0),
            
            kyp_data.get("forward/backward_citation_ratio", 0),
            kyp_data.get("npl_citations", 0),
            
            format_score("legal_status_score"),
            format_score("family_score"),
            format_score("shortest_ic_score"),
            format_score("age_score"),
            format_score("forward/backward_citation_ratio_score"),
            format_score("is_foward_citations_increasing_yearly_score"),
            format_score("count_of_rejections_on_novelty_score"),
            format_score("PTAB_records_score"),
            format_score("active_similar_docs_score"),
            format_score("family_active_stats_score")
        ]
        
        for col_idx, val in enumerate(row_vals, start=1):
            if isinstance(val, list):
                val = ", ".join([str(v) for v in val])
            c = ws_kyp.cell(row=curr_row, column=col_idx, value=val)
            c.font = body_font
            c.border = thin_border
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            if p_idx % 2 != 0:
                c.fill = alt_row_fill
        curr_row += 1

    # ---------------------------------------------------------
    # ADJUST COLUMN WIDTHS AUTOMATICALLY FOR ALL SHEETS
    # ---------------------------------------------------------
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)

            for cell in col:
                if ws.title == "Summary" and cell.row <= 2:
                    continue
                val = str(cell.value or "")
                lines = val.split("\n")
                line_len = max(len(l) for l in lines) if lines else 0
                max_len = max(max_len, line_len)

            adjusted_width = min(max(max_len + 4, 15), 60)
            ws.column_dimensions[col_letter].width = adjusted_width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()