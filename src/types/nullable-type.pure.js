import { NULLABLE_TYPE } from "../types.pure";

export function createNullableType(underlyingType) {
    return {
        type: NULLABLE_TYPE,
        underlyingType,
        toString() {
            return underlyingType.toString() + '?';
        }
    }
}
