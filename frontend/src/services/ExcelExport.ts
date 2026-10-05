import Api from "@/services/Api";
import { blob } from "stream/consumers";

export const ExcelExport = async (id: string, translate: boolean) => {
  const response = await Api.get(
    `/api/sessions/${id}/export`, {
      params: {
        translate: translate
      },
      responseType: "blob",
    },
    
  );

  return response.data;
};
