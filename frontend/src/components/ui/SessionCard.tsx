import { FolderOpen, Trash2, ArrowRight } from "lucide-react";

interface SessionCardProps {
  session: any;
  onDelete: () => void;
  onClick: () => void;
}

export default function SessionCard({
  session,
  onDelete,
  onClick
}: SessionCardProps) {

  return (

    <div
      onClick={onClick}
      className="
      relative
      cursor-pointer

      w-full
      rounded-2xl

      bg-white/40
      backdrop-blur-xl

      border-1
      border-red-200

      p-5

      shadow-sm

      "
    >


      {/* Header */}
      <div
        className="
        flex
        justify-between
        items-start
        "
      >


        {/* Icon */}
        <div
          className="
          w-11
          h-11

          rounded-xl

          bg-white/60
          backdrop-blur

          border
          border-white/70

          flex
          items-center
          justify-center

          "
        >
          <FolderOpen size={22} stroke="red"/>
        </div>



        {/* Delete */}
        <button
        onClick={(e) => {
          e.stopPropagation(),
          onDelete()
        }}
          type="button"
          className="
          p-2

          rounded-lg

          text-slate-400
        cursor-pointer
          hover:text-red-500
          hover:bg-white/60

          transition
          "
        >
          <Trash2 size={15}/>
        </button>


      </div>




      {/* Content */}
      <div className="mt-4">


        <div
          className="
          flex
          items-center
          justify-between
          gap-2
          "
        >

          <h3
            className="
            text-base
            font-semibold
            text-slate-800
            truncate
            "
          >
            {session.name}
          </h3>



          <span
            className={`
            text-[10px]
            px-2
            py-1
            rounded-full

            font-semibold
            text-white
            backdrop-blur

            border
            border-white/70

            ${
              session.status==="completed"
              ?
              "bg-green-400"
              :
              session.status==="processing"
              ?
              "bg-yellow-400"
              :
              "bg-red-400"
            }
            `}
          >
            {session.status.toUpperCase()}
          </span>


        </div>




        <p
          className="
          mt-2
          text-xs
          text-slate-600
          "
        >
          Created on {new Date(session.created_at).toLocaleDateString()}
        </p>


      </div>





      {/* Footer */}
      <div
        className="
        mt-5
        pt-4

        border-t
        border-white/70

        flex
        justify-between
        items-center
        "
      >


        <div>

          <p
            className="
            text-[15px]
            font-semibold
            text-slate-700
            "
          >
            Patents
          </p>


          <p
            className="
            text-sm
            font-semibold
            text-slate-500
            "
          >
            {session.processed_patents}

            <span className="text-slate-700 font-semibold">
              {" "}/ {session.total_patents}
            </span>

          </p>


        </div>




        <div
          className="
          w-8
          h-8

          rounded-lg

          bg-white/50
          backdrop-blur

          border
          border-white/70

          flex
          items-center
          justify-center

          text-slate-500
          "
        >
          <ArrowRight size={15}/>
        </div>


      </div>


    </div>

  );
}