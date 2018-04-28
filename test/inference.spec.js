const types = require('../src/types.pure');
const typeinference = require('../src/inference.pure');

describe('type inference', function(){
    function analyseExpr(s) {
        return typeinference.analyseSource('return ' + s);
    }
    function typeOfExpr(s) {
        return analyseExpr(s).toString();
    }

    describe('literals', function() {
        it('numbers', function(){
            expect(typeOfExpr('-1')).toBe('Number');
            expect(typeOfExpr('-99999')).toBe('Number');
            expect(typeOfExpr('0')).toBe('Number');
            expect(typeOfExpr('100')).toBe('Number');
        });

        it('strings', function(){
            expect(typeOfExpr('"100"')).toBe('String');
            expect(typeOfExpr('""')).toBe('String');
            expect(typeOfExpr("'100'")).toBe('String');
            expect(typeOfExpr("''")).toBe('String');
        });

        it('booleans', function(){
            expect(typeOfExpr('false')).toBe('Boolean');
            expect(typeOfExpr('true')).toBe('Boolean');
        });

        it('arrays of primitives', function(){
            expect(analyseExpr('[""]').props['0'].toString()).toBe('String');
            expect(analyseExpr('[""]').props[types.ARRAY_LOOKUP_OPERATOR].toString()).toBe('Number -> String?');
            expect(analyseExpr('[true, false]').props['0'].toString()).toBe('Boolean');
            expect(analyseExpr('[true, false]').props['1'].toString()).toBe('Boolean');
            expect(analyseExpr('[1, 2, 3]').props['2'].toString()).toBe('Number');
        });

        it('types empty arrays as generic', function() {
            const type = analyseExpr('[]');
            expect(type.type).toBe(types.OBJECT_TYPE);
            expect(''+type.props[types.ARRAY_LOOKUP_OPERATOR]).toBe('Number -> #a?');
        });

        it('objects', function() {
            expect(typeOfExpr('{}')).toBe('{}');
            expect(typeOfExpr('{a: 1}')).toBe('{a: Number}');
            expect(typeOfExpr('{a: 1, b: true}')).toBe('{a: Number, b: Boolean}');
            expect(typeOfExpr("{'a': 1}")).toBe('{a: Number}');
            // expect(typeOfCode('{"a": 1, \'b\': true}')).toBe('{"a": Number, "b": Boolean}');
            expect(typeOfExpr("{4: '1'}")).toBe("{4: String}");
            expect(typeOfExpr("{4: {'1': 1}}")).toBe('{4: {1: Number}}');
        });
    });

    describe('functions', function () {
        it('types identity function', () => {
            expect(typeOfExpr('x => x')).toBe('#a -> #a');
        });

        it('types higher order function', () => {
            expect(typeOfExpr('function compose(f, g) { return x => g(f(x)) }'))
                .toBe('(#a -> #b, #b -> #c) -> #a -> #c');
        });

        it('infers number from function body', () => {
            expect(typeOfExpr('x => -x')).toBe('Number -> Number');
            expect(typeOfExpr('x => x < 10')).toBe('Number -> Boolean');
        });

        it('allows polymorphic function to be called twice with different types', () => {
            expect(() => {
                typeOfExpr(`() => {
                    const id = x => x;
                    id(1);
                    id('a');
                }`);
            }).not.toThrow();
        });
    });

    describe('operators', () => {
        describe('logical', () => {
            it('infers boolean type', () => {
                expect(typeOfExpr('x => !x')).toBe('#a -> Boolean');
            });
        });

        describe('arithmetic', () => {
            it('infers numeric type', () => {
                expect(typeOfExpr('(x,y) => x + y')).toBe('(Number, Number) -> Number');
            });

            it('rejects bad calls', () => {
                expect(() => {
                    typeOfExpr(`1 + "a"`)
                }).toThrow();

                expect(() => {
                    typeOfExpr(`1 + []`)
                }).toThrow();

                expect(() => {
                    typeOfExpr(`1 + {}`)
                }).toThrow();
            });
        });
    });

    describe('property access', () => {
        it('infers type from chained property access', () => {
            expect(typeOfExpr('a => a.x.y.z[0]')).toBe('{x: {y: {z: {0: #a}}}} -> #a');

            expect(() => {
                analyseExpr(`const f = a => a.x.y.z[0]; f({ x: {} })`)
            }).toThrow();
        });

        it('infers type of property from use', () => {
            expect(typeOfExpr('a => a.x + 1')).toBe('{x: Number} -> Number');
            expect(typeOfExpr('a => a.x + a.y')).toBe('{x: Number, y: Number} -> Number');

            expect(() => {
                analyseExpr(`const f = a => a.x + a.y; return f({ x: 1, y: 'a' })`)
            }).toThrow();
        });
    });

    describe('recursion', () => {
        it('types recursive fibonacci', () => {
            expect(typeOfExpr('function fib(n) { return n < 1 ? 1 : fib(n-2) + fib(n-1) }'))
                .toBe('Number -> Number');
        });
    });

    // describe("shouldn't type literal", function() {
    //     it('heterogeneous arrays', function() {
    //         expect(function() {
    //             console.log( 'HA', typeOfExpr('[1, true]') );
    //         }).toThrow();
    //     });
    // });
});
