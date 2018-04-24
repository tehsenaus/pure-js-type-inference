var typeinference = require('../src/inference.pure');

describe('type inference', function(){
    function typeOfExpr(s) {
        return typeinference.analyseSource('return ' + s).toString();
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

        // it('arrays of primitives', function(){
        //     expect(typeOfExpr('[""]')).toBe('[String]');
        //     expect(typeOfExpr('[true, false]')).toBe('[Boolean]');
        //     expect(typeOfExpr('[1, 2, 3]')).toBe('[Number]');
        // });

        // it('empty arrays as generic', function() {
        //     var type = typeOfCode('[]');
        //     expect(type instanceof types.ArrayType).toBe(true);
        //     expect(type.type instanceof types.Variable).toBe(true);
        // });

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

        it('infers number from function body', () => {
            expect(typeOfExpr('x => -x')).toBe('Number -> Number');
            expect(typeOfExpr('x => x < 10')).toBe('Number -> Boolean');
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
