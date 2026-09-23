"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, X, FileSpreadsheet } from "lucide-react";
import { ExcelExport } from "@/services/ExcelExport";

interface ExcelPreviewProps {
  sessionId: string;
}

interface ExcelSheet {
  name: string;

  data: any[];
}

const ExcelPreview = ({ sessionId }: ExcelPreviewProps) => {
  const [open, setOpen] = useState(false);
  const [sheets, setSheets] = useState<ExcelSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [excelFile, setExcelFile] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);

  // Translation modal
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const previewExcel = async () => {
    try {
      setLoading(true);

      // Preview always uses translate=false
      const file = await ExcelExport(sessionId, false);

      setExcelFile(file);

      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
      });

      const excelSheets: ExcelSheet[] = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        return {
          name: sheetName,
          data,
        };
      });

      setSheets(excelSheets);
      setActiveSheet(0);
      setOpen(true);
    } catch (error) {
      console.error("Excel preview failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Open translation modal
  const downloadExcel = () => {
    setShowTranslateModal(true);
  };

  // Download Excel with selected translation option
  const confirmDownload = async (translate: boolean) => {
    try {
      setDownloading(true);

      setShowTranslateModal(false);

      // Call API with translate=true/false
      const file = await ExcelExport(sessionId, translate);

      const url = URL.createObjectURL(file);

      const link = document.createElement("a");

      link.href = url;
      link.download = translate ? "export_translated.xlsx" : "export.xlsx";

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Excel download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  const currentSheet = sheets[activeSheet];
  const columns = currentSheet?.data?.length
    ? Object.keys(currentSheet.data[0])
    : [];

  return (
    <>
      {/* Preview Button */}
      <button
        onClick={previewExcel}
        disabled={loading}
        className="
          flex items-center gap-2
          bg-white
          border border-slate-200
          text-slate-500
          hover:bg-slate-100
          cursor-pointer
          px-4 py-2
          rounded-xl
      "
      >
        <FileSpreadsheet size={18} color="white" fill="green" />

        {loading ? "Loading..." : "Preview Excel"}
      </button>

      {/* Excel Preview Modal */}
      {open && (
        <div
          className="
            fixed inset-0
            z-40
            flex items-center justify-center
            bg-black/50
          "
        >
          <div
            className="
              bg-white
              w-[90%]
              h-[85%]
              rounded-xl
              shadow-xl
              flex flex-col
            "
          >
            {/* Header */}
            <div
              className="
                flex items-center justify-between
                px-5 py-4
                border-b
              "
            >
              <h2 className="text-lg font-semibold text-black">
                Excel Preview
              </h2>

              <button
                onClick={() => setOpen(false)}
                className="text-gray-600 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sheet Tabs */}
            <div
              className="
                flex gap-2
                px-5 py-3
                border-b
                overflow-x-auto
              "
            >
              {sheets.map((sheet, index) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(index)}
                  className={`
                    px-3 py-1.5
                    rounded-md
                    text-sm
                    whitespace-nowrap
                    ${
                      activeSheet === index
                        ? "bg-slate-500 text-white"
                        : "bg-gray-200 text-black hover:bg-gray-300"
                    }
                  `}
                >
                  {sheet.name}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-5">
              {currentSheet?.data?.length ? (
                <table className="border-collapse w-full text-sm text-black">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          className="
                            border
                            px-3 py-2
                            bg-gray-100
                            text-left
                            font-semibold
                            whitespace-nowrap
                          "
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {currentSheet.data.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {columns.map((column) => (
                          <td
                            key={column}
                            className="
                              border
                              px-3 py-2
                              bg-white
                            "
                          >
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="
                flex justify-end
                px-5 py-4
                border-t
              "
            >
              <button
                onClick={downloadExcel}
                disabled={downloading}
                className="
                  flex items-center gap-2
                  bg-green-600
                  hover:bg-green-700
                  text-white
                  px-4 py-2
                  rounded-lg
                  disabled:opacity-50
                  transition
                  cursor-pointer
                  disabled:cursor-not-allowed
                "
              >
                <Download size={18} />

                {downloading ? "Downloading..." : "Download Excel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Translate Modal */}
      {showTranslateModal && (
        <div
          className="
            fixed inset-0
            z-50
            flex items-center justify-center
            bg-black/50
          "
        >
          <div
            className="
              bg-white
              w-[420px]
              rounded-xl
              shadow-2xl
              p-6
            "
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-black">
                Download Excel
              </h2>

              <button
                onClick={() => setShowTranslateModal(false)}
                className="text-gray-500 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <p className="text-sm text-gray-600 mb-6">
              Would you like to translate the Excel content to English before
              downloading?
            </p>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => confirmDownload(false)}
                disabled={downloading}
                className="
                  px-4 py-2
                  rounded-lg
                  border
                  border-gray-300
                  bg-white
                  text-black
                  hover:bg-gray-50
                  disabled:opacity-50
                "
              >
                Download Original
              </button>

              <button
                onClick={() => confirmDownload(true)}
                disabled={downloading}
                className="
                  px-4 py-2
                  rounded-lg
                  border
                  border-gray-300
                  bg-white
                  text-black
                  hover:bg-gray-50
                  disabled:opacity-50
                "
              >
                Translate to English
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default ExcelPreview;
