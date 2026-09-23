import React from "react";
import {
  ExternalLink,
  Calendar,
  Building2,
  Loader2,
  FileBarChart,
} from "lucide-react";

interface ProductCardProps {
  product: any;

  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;

  isGenerating?: boolean;
  hasClaimChart?: boolean;
  onGenerateClaimChart?: () => void;
  onViewClaimChart?: () => void;
}

export default function ProductCard({
  product: p,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  isGenerating = false,
  hasClaimChart = false,
  onViewClaimChart,
}: ProductCardProps) {

  const probability = p.eou_probability?.toLowerCase() || "";

  const probStyle =
    probability === "high"
      ? "bg-rose-50 text-rose-600 border-rose-200"
      : probability === "medium"
      ? "bg-amber-50 text-amber-600 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";


  const launchDateDisplay = p.launch_date
    ? p.launch_date.split(" (")[0]
    : "";


  const handleCardClick = () => {
    if (isSelectionMode && onSelect) {
      onSelect(!isSelected);
    }
  };


  return (
    <div
      onClick={handleCardClick}
      className={`
        bg-white rounded-xl border shadow-sm overflow-hidden
        transition-all duration-200
        ${
          isSelectionMode
            ? "cursor-pointer hover:shadow-md"
            : ""
        }
        ${
          isSelected
            ? "border-indigo-500 ring-2 ring-indigo-200"
            : "border-slate-200 hover:border-slate-300"
        }
      `}
    >

      {/* Header */}
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between gap-4">

        <div className="flex gap-3">

          {/* Selection */}
          {isSelectionMode && (
            <div className="pt-1">
              <div
                onClick={(e)=>{
                  e.stopPropagation();
                  onSelect?.(!isSelected);
                }}
                className={`
                  w-5 h-5 rounded-md border flex items-center justify-center
                  transition
                  ${
                    isSelected
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-slate-300"
                  }
                `}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          )}


          <div>

            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-lg">
              <Building2 size={18}/>
              {p.company}
            </div>


            <div className="text-slate-800 font-medium text-lg mt-1">
              {p.model}
            </div>


            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-3">

              {p.eou_probability && (
                <span
                  className={`
                    px-2.5 py-1 rounded-md border
                    text-[10px] font-semibold uppercase
                    tracking-wide flex items-center gap-1
                    ${probStyle}
                  `}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"/>
                  {p.eou_probability} Probability
                </span>
              )}


              {p.competitor_type && (
                <span
                  className="
                    px-2.5 py-1 rounded-md
                    text-[10px] uppercase font-semibold
                    tracking-wide
                    bg-indigo-50 text-indigo-600
                    border border-indigo-200
                  "
                >
                  {p.competitor_type}
                </span>
              )}


              {isGenerating && (
                <span
                  className="
                    px-2.5 py-1 rounded-md
                    text-[10px] uppercase font-semibold
                    bg-amber-50 text-amber-600
                    border border-amber-200
                    flex items-center gap-1
                  "
                >
                  <Loader2 size={11} className="animate-spin"/>
                  Generating
                </span>
              )}


              {hasClaimChart && !isGenerating && (
                <span
                  className="
                    px-2.5 py-1 rounded-md
                    text-[10px] uppercase font-semibold
                    bg-emerald-50 text-emerald-600
                    border border-emerald-200
                  "
                >
                  Chart Ready
                </span>
              )}

            </div>

          </div>

        </div>


        {launchDateDisplay &&
          launchDateDisplay !== "NA" && (

          <div
            className="
              h-fit flex items-center gap-1.5
              px-3 py-1.5 rounded-lg
              bg-white border border-slate-200
              text-xs text-slate-500
            "
          >
            <Calendar size={13}/>
            {launchDateDisplay}
          </div>

        )}

      </div>



      {/* Excerpt */}
      {p.relevant_excerpt && (

        <div className="px-5 py-4 border-b border-slate-200">

          <div className="
            text-[10px]
            uppercase tracking-wider
            font-semibold
            text-slate-400
            mb-2
          ">
            Relevant Excerpt
          </div>


          <blockquote
            className="
              border-l-2 border-indigo-400
              pl-4
              text-sm
              text-slate-600
              italic
              leading-relaxed
            "
          >
            "{p.relevant_excerpt}"
          </blockquote>

        </div>

      )}



      {/* Evidence */}
      {p.infringement_evidence_links?.length > 0 && (

        <div className="px-5 py-4">

          <div
            className="
              text-[10px]
              uppercase
              tracking-wider
              font-semibold
              text-slate-400
              mb-3
            "
          >
            Evidence Links
          </div>


          <div className="space-y-3">

          {p.infringement_evidence_links.map(
            (rawLink:string,index:number)=>{

              const [url,verification] =
                rawLink.split(" | ");

              return (

                <div
                  key={index}
                  className="flex gap-2"
                >

                  <ExternalLink
                    size={14}
                    className="text-indigo-500 mt-1 shrink-0"
                  />

                  <div>

                    <a
                      href={url?.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e)=>e.stopPropagation()}
                      className="
                        text-sm
                        text-indigo-600
                        hover:underline
                        break-all
                      "
                    >
                      {url?.trim()}
                    </a>


                    {verification && (

                      <div
                        className={`
                          text-[10px]
                          font-semibold
                          uppercase
                          mt-1
                          ${
                            verification.trim()==="VERIFIED"
                            ?"text-emerald-600"
                            :"text-amber-600"
                          }
                        `}
                      >
                        {verification.trim()}
                      </div>

                    )}

                  </div>

                </div>

              );
            }
          )}

          </div>

        </div>

      )}



      {/* Action */}
      {!isSelectionMode &&
      (hasClaimChart || isGenerating) && (

        <div
          className="
            px-5 py-3
            bg-slate-50
            border-t border-slate-200
            flex justify-end
          "
        >

          {hasClaimChart ? (

            <button
              onClick={(e)=>{
                e.stopPropagation();
                onViewClaimChart?.();
              }}
              className="
                flex items-center gap-2
                px-4 py-2
                rounded-lg
                text-sm font-semibold
                bg-emerald-50
                text-emerald-700
                border border-emerald-200
                hover:bg-emerald-100
              "
            >
              <FileBarChart size={15}/>
              View Claim Chart
            </button>

          ) : (

            <button
              disabled
              className="
                flex items-center gap-2
                px-4 py-2
                rounded-lg
                text-sm font-semibold
                bg-slate-100
                text-slate-400
                border border-slate-200
              "
            >
              <Loader2
                size={15}
                className="animate-spin"
              />
              Generating...
            </button>

          )}

        </div>

      )}

    </div>
  );
}