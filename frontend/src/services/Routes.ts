const Routes = {
    Get_Sessions: {
        route: "/api/sessions/"
    },

    Get_Sessions_By_Id: {
        route: (id: string) => `/api/sessions/${id}`
    },

    Export_Excel: {
        route: (id: string) => `/api/sessions/${id}/export`
    },

    Delete_Session: {
        route: (id: string) => `/api/sessions/${id}`
    },

    Create_Session: {
        route: (name: string) => `/api/sessions/?name=${encodeURIComponent(name)}`
    }  

}
export default Routes;