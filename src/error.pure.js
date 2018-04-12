
export function throwNiceError(e, src, node) {
    if ( e.niceError ) throw e;

    const snippet = src.slice(node.start, node.end);
    const lines = src.split('\n');
    const offset = 3;
    const msg = lines
        .slice(node.loc.start.line - 1, node.loc.end.line)
        .map((line, i) => (node.loc.start.line + i) + '| ' + line)
        .join('\n') + '\n' +
        src.slice(0, offset + node.loc.start.column - 1).replace(/./g, ' ') +
        src.slice(offset + node.loc.start.column - 1, offset + node.loc.end.column).replace(/./g, '^');
    
    throw {
        msg,
        niceError: true,
        // stack: e.stack,
        toString() {
            return '' + e + '\n' + msg + '\n\nOriginal error:\n' + (e.stack || '');
        }
    };
}
