const types = require('../src/types.pure');
const typeinference = require('../src/inference.pure');

describe('type inference examples', function() {
    function analyseExpr(s) {
        return typeinference.analyseSource('return ' + s);
    }
    function typeOfExpr(s) {
        return analyseExpr(s).toString();
    }

    describe('reduceWithState', () => {
        const reduceWithState = `
            const reduceWithState = (state, values, f, initial) => {
                return values.reduce((acc, v, i) => {
                    const r = f(acc.result, v, acc.nextState, i);
                    return { result: r.result, nextState: r.state };
                }, { result: initial, nextState: state });
            };
        `;

        it('accepts array', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState({}, [1, 2], (acc, v, state, i) => ({ result: {}, state: {} }), {});
                `)
            }).not.toThrow();
        });

        it('accepts correct state', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState(
                        { myState: 'somestr' },
                        [1, 2],
                        (acc, v, state, i) => ({ result: {}, state: { myState: 'newstr' } }),
                        {}
                    );
                `)
            }).not.toThrow();
        });

        it('accepts correct result', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState(
                        { myState: 'somestr' },
                        [1, 2],
                        (acc, v, state, i) => ({ result: 1, state: {} }),
                        0
                    );
                `)
            }).not.toThrow();
        });

        it('rejects wrong result', false, () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState(
                        { myState: 'somestr' },
                        [1, 2],
                        (acc, v, state, i) => ({ result: 'somestr', state: {} }),
                        0
                    );
                `)
            }).toThrow();
        });

        it('rejects wrong state primitive returned from reducer', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState(
                        { myState: 'somestr' },
                        [1, 2],
                        (acc, v, state, i) => ({ result: {}, state: Number }),
                        {}
                    );
                `)
            }).toThrow();
        });

        it('rejects wrong state object returned from reducer', false, () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState(
                        { myState: 'somestr' },
                        [1, 2],
                        (acc, v, state, i) => ({ result: {}, state: {} }),
                        {}
                    );
                `)
            }).toThrow();
        });

        it('rejects object', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState({}, { x: 1, y: 2 }, (acc, v, state, i) => ({ result: {}, state: {} }), {});
                `)
            }).toThrow();
        });

        it('rejects wrong map function return type', () => {
            expect(() => {
                typeinference.analyseSource(`
                    ${reduceWithState}
                    return reduceWithState({}, [1, 2], (acc, v, state, i) => ({}), {});
                `)
            }).toThrow();
        });
    });
});
