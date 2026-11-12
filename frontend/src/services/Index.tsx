import { Route } from "lucide-react";
import Api from "./Api"
import Routes from "./Routes"
export const GetSessionById = async (id: string) => {
    const response = await Api.get(Routes.Get_Sessions_By_Id.route(id), {
        headers: {
            "Content-Type": "application/json",
        }
    });

    return response.data;
}

export const GetSessions = async () => {
    const response = await Api.get(Routes.Get_Sessions.route, {
        headers: {
            "Content-Type": "application/json"
        }
    });
    return response.data;
}

export const DeleteSession = async (id: string) => {
    const response = await Api.delete(Routes.Delete_Session.route(id), {
        headers: {
            "Content-Type": "application/json"
        }
    });
    return response.data;
}

export const CreateSession = async (name: string) => {
    const response = await Api.post(Routes.Create_Session.route(name), {
        headers: {
            "Content-Type": "application/json",
        }
    }
);
    return response.data;
}

export const ExcelExport = async (id: string, translate: boolean) => {
    const response = await Api.get(Routes.Export_Excel.route(id), {
        params: {
            translate: translate,
        },
        headers: {
            "Content-Type": "applcation/json"
        },
        responseType: "blob",
    })
    return response.data
}

export const IngestPatents = async (id: string, patentNumbers: string[]) => {
    const response = await Api.post(Routes.Ingest_Patents.route(id), {
        patent_numbers: patentNumbers
    }, {
        headers: {
            "Content-Type": "application/json"
        }
    });
    return response.data;
}

export const RetryPatents = async (id: string, payload: { patent_numbers?: string[]; retry_all_failed?: boolean }) => {
    const response = await Api.post(Routes.Retry_Patents.route(id), payload, {
        headers: {
            "Content-Type": "application/json"
        }
    });
    return response.data;
}
