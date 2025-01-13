import { _api_request, _response } from "../types/models.type";

export function createResponse(response: _response): _api_request {
    return {
        success: true,
        message: response.message,
        data: response.data
    }
}