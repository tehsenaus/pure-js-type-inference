
import { TYPE_VARIABLE } from './type-constants.pure';

/**
 * A type variable represents an parameter with an unknown type or any
 * polymorphic type. For example:
 * 
 *     id = x => x
 * 
 * Here, `id` has the polymorphic type `#a -> #a`.
 */
export function createTypeVariable(id, { bound = false } = {}) {
    return {
        type: TYPE_VARIABLE,
        id,
        bound,
        toString() {
            return "#" + variableToString(id);
        }
    };
}

// Type variables should look like `'a`. If the variable has an instance, that
// should be used for the string instead.
//
// This is just bijective base 26.
export function variableToString(n) {
    if (n >= 26) {
        return variableToString(n / 26 - 1) + toChar(n % 26);
    } else {
        return toChar(n);
    }
    
    return a + toChar(n);
}

export function variableFromString(vs) {
    return _.reduce(_.map(vs.split(''), function(v, k) {
        return v.charCodeAt(0) - 'a'.charCodeAt(0) + 26 * k;
    }), function(accum, n) {
        return accum + n;
    }, 0);
}

function toChar(n) {
    return String.fromCharCode("a".charCodeAt(0) + n);
}
