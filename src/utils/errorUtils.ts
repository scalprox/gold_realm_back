import { _api_request_error, _error } from "../types/models.type";

export function createError(error: _error): _api_request_error {
    switch (error.type) {
        case "global":
            return {
                success: false,
                error: {
                    code: error.code,
                    type: error.type
                },
                detail: error.detail || undefined
            }
        case "user":
            return {
                success: false,
                error: {
                    code: error.code,
                    type: error.type
                },
                detail: error.detail || undefined
            }
        case "trip":
            return {
                success: false,
                error: {
                    code: error.code,
                    type: error.type
                },
                detail: error.detail || undefined
            }
        case "nft":
            return {
                success: false,
                error: {
                    code: error.code,
                    type: error.type
                },
                detail: error.detail || undefined
            }
    }

}