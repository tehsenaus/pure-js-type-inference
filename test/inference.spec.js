var typeinference = require('../src/inference.pure');

describe('type inference', function(){
    function typeOfCode(s) {
        return typeinference.analyseSource('return ' + s).toString();
    }

    describe('literals', function() {
        it('numbers', function(){
            expect(typeOfCode('-1')).toBe('Number');
            expect(typeOfCode('-99999')).toBe('Number');
            expect(typeOfCode('0')).toBe('Number');
            expect(typeOfCode('100')).toBe('Number');
        });

        it('strings', function(){
            expect(typeOfCode('"100"')).toBe('String');
            expect(typeOfCode('""')).toBe('String');
            expect(typeOfCode("'100'")).toBe('String');
            expect(typeOfCode("''")).toBe('String');
        });

        it('booleans', function(){
            expect(typeOfCode('false')).toBe('Boolean');
            expect(typeOfCode('true')).toBe('Boolean');
        });

        // it('arrays of primitives', function(){
        //     expect(typeOfCode('[""]')).toBe('[String]');
        //     expect(typeOfCode('[true, false]')).toBe('[Boolean]');
        //     expect(typeOfCode('[1, 2, 3]')).toBe('[Number]');
        // });

        // it('empty arrays as generic', function() {
        //     var type = typeOfCode('[]');
        //     expect(type instanceof types.ArrayType).toBe(true);
        //     expect(type.type instanceof types.Variable).toBe(true);
        // });

        it('objects', function() {
            expect(typeOfCode('{}')).toBe('{}');
            expect(typeOfCode('{a: 1}')).toBe('{a: Number}');
            expect(typeOfCode('{a: 1, b: true}')).toBe('{a: Number, b: Boolean}');
            expect(typeOfCode("{'a': 1}")).toBe('{a: Number}');
            // expect(typeOfCode('{"a": 1, \'b\': true}')).toBe('{"a": Number, "b": Boolean}');
            expect(typeOfCode("{4: '1'}")).toBe("{4: String}");
            expect(typeOfCode("{4: {'1': 1}}")).toBe('{4: {1: Number}}');
        });
    });

    describe('functions', function () {
        it('types identity function', () => {
            expect(typeOfCode('x => x')).toBe('#a -> #a');
        });

        it('infers number from function body', () => {
            expect(typeOfCode('x => -x')).toBe('Number -> Number');
            expect(typeOfCode('x => x < 10')).toBe('Number -> Boolean');
        });
    });

    describe("shouldn't type literal", function() {
        it('heterogeneous arrays', function() {
            expect(function() {
                typeOfCode('[1, true]');
            }).toThrow();
        });
    });
});
