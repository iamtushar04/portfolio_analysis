"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { X, Download } from "lucide-react";
import { ExcelExport } from "@/services/ExcelExport";

interface ExcelPreviewProps {
  sessionId: string;
}

interface ExcelSheet {
  name: string;
  data: any[];
}

const ExcelPreview = ({
  sessionId,
}: ExcelPreviewProps) => {


  const [open, setOpen] = useState(false);

  const [sheets, setSheets] = useState<ExcelSheet[]>([]);

  const [activeSheet, setActiveSheet] = useState(0);

  const [translate, setTranslate] = useState(false);

  const [loading, setLoading] = useState(false);

  const [downloading, setDownloading] = useState(false);



  const currentSheet =
    sheets[activeSheet];



  const columns =
    currentSheet?.data?.length
      ?
      Object.keys(
        currentSheet.data[0]
      ).filter(
        (column) =>
          !column
            .toLowerCase()
            .startsWith("empty")
      )
      :
      [];





  const loadExcelPreview = async (
    translateValue: boolean
  ) => {

    try {

      setLoading(true);


      const file =
        await ExcelExport(
          sessionId,
          translateValue
        );


      const buffer =
        await file.arrayBuffer();



      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",
          }
        );



      const parsedSheets: ExcelSheet[] =
        workbook.SheetNames.map(
          (sheetName) => {


            const worksheet =
              workbook.Sheets[sheetName];



            const rows =
              XLSX.utils.sheet_to_json(
                worksheet,
                {
                  header: 1,
                  defval: "",
                }
              ) as any[][];



            const filteredRows =
              rows.filter(
                (row) =>
                  row.some(
                    (cell) =>
                      String(cell).trim() !== ""
                  )
              );



            if (!filteredRows.length) {

              return {
                name: sheetName,
                data: [],
              };

            }




            let headerRowIndex = 0;
            if (sheetName === "KYP Analysis" && filteredRows.length > 1) {
              headerRowIndex = 1; // Skip the merged group titles
            }

            const headers =
              filteredRows[headerRowIndex].map(
                (header, index) =>
                  String(header).trim()
                  ||
                  `Column_${index + 1}`
              );



            const data =
              filteredRows
                .slice(headerRowIndex + 1)
                .map(
                  (row) => {

                    const obj: any = {};

                    headers.forEach(
                      (header, index) => {

                        obj[header] =
                          row[index] ?? "";

                      }
                    );


                    return obj;

                  }
                );



            return {
              name: sheetName,
              data,
            };


          }
        );



      const currentTab = activeSheet;

setSheets(parsedSheets);

setActiveSheet(currentTab);

setOpen(true);



    }
    catch(error){

      console.error(
        "Excel preview error",
        error
      );

    }
    finally {

      setLoading(false);

    }

  };







  const handleDownload = async () => {

    try {

      setDownloading(true);


      const file =
        await ExcelExport(
          sessionId,
          translate
        );



      const url =
        window.URL.createObjectURL(
          file
        );



      const link =
        document.createElement("a");



      link.href = url;

      link.download =
        "Portfolio_Analysis_Report.xlsx";



      document.body.appendChild(link);

      link.click();

      link.remove();



      window.URL.revokeObjectURL(url);



    }
    catch(error){

      console.error(
        "Download error",
        error
      );

    }
    finally{

      setDownloading(false);

    }

  };







  return (

    <>


      <button

        onClick={() =>
          loadExcelPreview(
            translate
          )
        }

        className="w-[150px]
          px-4
          py-2
          bg-green-200
          text-slate-700
          font-semibold
          hover:bg-green-300
          cursor-pointer

          transition
          rounded-xl
        "

      >

        {
          loading
          ?
          "Loading..."
          :
          "Preview Excel"
        }

      </button>







      {
        open && (

          <div

            className="
              fixed
              inset-0
              z-[9999]
              bg-black/60
              flex
              items-center
              justify-center
            "

          >




            <div

              className="
                bg-white
                fixed top-0
                w-[95vw]
                h-[95vh]
                rounded-xl
                shadow-2xl
                flex
                flex-col
                overflow-hidden
              "

            >





              {/* HEADER */}


              <div

                className="
                  flex
                  justify-between
                  items-center
                  px-6
                  py-4
                  border-b
                  shrink-0
                "

              >



                <h2

                  className="
                    text-lg
                    font-semibold
                    text-black
                  "

                >

                  Excel Preview

                </h2>





                <div

                  className="
                    flex
                    items-center
                    gap-5
                  "

                >



                  <label

                    className="
                      flex
                      items-center
                      gap-2
                      text-sm
                      text-black
                    "

                  >

                    <input

                      type="checkbox"
                      

                      checked={translate}

                      onChange={(e)=>{

                        const value =
                          e.target.checked;


                        setTranslate(value);


                        loadExcelPreview(
                          value
                        );

                      }}

                    />


                    Translate to English


                  </label>






                  <button

                    onClick={() =>
                      setOpen(false)
                    }

                    className="
                      text-gray-600
                      hover:text-black
                      cursor-pointer
                    "

                  >

                    <X size={22}/>


                  </button>



                </div>


              </div>









              {/* TABS */}



              <div

                className="
                  flex
                  gap-2
                  px-6
                  py-3
                  border-b
                  overflow-x-auto
                  shrink-0
                "

              >



                {
                  sheets.map(
                    (sheet,index)=>(


                      <button

                        key={sheet.name}

                        onClick={() =>
                          setActiveSheet(index)
                        }


                        className={`

                          px-4
                          py-2
                          rounded-md
                          text-sm
                          cursor-pointer

                          ${
                            activeSheet === index

                            ?

                            "bg-[#b90000] text-white"

                            :

                            "bg-slate-100 text-slate-700"

                          }

                        `}

                      >

                        {sheet.name}


                      </button>


                    )

                  )

                }


              </div>









              {/* TABLE */}

<div
  className="
    
    overflow-auto
    relative
  "
>

{
currentSheet?.data?.length

?

(

<table
  className={`
    border-separate
    border-spacing-0
    
    
    text-sm
    text-black

    ${
      currentSheet.name === "KYP Analysis"
      ?
      "min-w-[1800px]"
      :
      "w-full"
    }

    table-fixed
  `}
>

<thead>

{

activeSheet === 0

?

(

<tr>

<th
  colSpan={columns.length}
  className="
    sticky
    top-0
    z-20
    border-b
    border-r
    px-5
    py-3
    bg-gray-100
    text-center
    font-semibold
    text-lg
    text-black
    whitespace-nowrap
  "
>

Portfolio Analysis Report

</th>

</tr>

)

:

(

<tr>

{
columns.map(
(column, colIndex)=>{

  const isKyp = currentSheet.name === "KYP Analysis";
  const frozenColCount = 3;
  const frozenColWidth = 220;
  const isFrozen = isKyp && colIndex < frozenColCount;
  const frozenLeft = colIndex * frozenColWidth;

  return (
<th
key={column}
className={`
  sticky
  top-0
  border-b
  border-r
  px-5
  py-3
  bg-gray-100
  text-left
  font-semibold
  text-black
  whitespace-nowrap

  ${ isFrozen ? "z-30" : "z-20" }

  ${
    isKyp

    ?

    (
      column.toLowerCase().includes("analysis")
      ||
      column.toLowerCase().includes("insight")
      ||
      column.toLowerCase().includes("description")
      ||
      column.toLowerCase().includes("comment")
      ?

      "min-w-[500px]"

      :

      "min-w-[220px]"
    )

    :

    column.toLowerCase() === "abstract"

    ?

    "min-w-[500px]"

    :

    column.toLowerCase() === "assignee"

    ?

    "min-w-[350px]"

    :

    "min-w-[200px]"
  }

`}
style={isFrozen ? { position: "sticky", left: `${frozenLeft}px`, zIndex: 30, backgroundClip: "padding-box" } : {}}
>

{column}

</th>
  );
}
)

}

</tr>

)

}

</thead>






<tbody>

{
currentSheet.data.map(
(row,rowIndex)=>(


<tr
key={rowIndex}
>

{
columns.map(
(column, colIndex)=>{

  const isKyp = currentSheet.name === "KYP Analysis";
  const frozenColCount = 3;
  const frozenColWidth = 220;
  const isFrozen = isKyp && colIndex < frozenColCount;
  const frozenLeft = colIndex * frozenColWidth;

  return (
<td
key={column}
className={`
  border-b
  border-r
  px-5
  py-3
  bg-white
  align-top
  text-black
  whitespace-normal
  break-words

  ${
    isKyp

    ?

    (
      column.toLowerCase().includes("analysis")
      ||
      column.toLowerCase().includes("insight")
      ||
      column.toLowerCase().includes("description")
      ||
      column.toLowerCase().includes("comment")

      ?

      "min-w-[500px]"

      :

      "min-w-[220px]"
    )

    :

    column.toLowerCase() === "abstract"

    ?

    "min-w-[500px]"

    :

    column.toLowerCase() === "assignee"

    ?

    "min-w-[350px]"

    :

    "min-w-[200px]"
  }

`}
style={isFrozen ? { position: "sticky", left: `${frozenLeft}px`, zIndex: 10, background: "white", backgroundClip: "padding-box" } : {}}
>

{row[column]}

</td>
  );
}
)

}


</tr>


)

)

}

</tbody>


</table>

)

:

(

<div
className="
flex
items-center
justify-center
h-full
text-gray-500
"
>
No data available
</div>

)

}

</div>








              {/* FOOTER */}



              <div

                className="
                  border-t
                  px-6
                  py-4
                  flex
                  justify-end
                  shrink-0
                "

              >



                <button

                  onClick={handleDownload}

                  disabled={downloading}


                  className="
                    flex
                    items-center
                    gap-2
                    px-5
                    py-2
                    bg-green-400
                    text-white
                    rounded-md
                    hover:bg-green-500
                    active:bg-green-600
                    transition
                    cursor-pointer
                    disabled:opacity-50
                  "

                >


                  <Download size={18}/>


                  {

                    downloading

                    ?

                    "Downloading..."

                    :

                    "Download Excel"

                  }


                </button>



              </div>






            </div>



          </div>


        )
      }



    </>

  );

};


export default ExcelPreview;