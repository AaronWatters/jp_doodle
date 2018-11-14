
/*
global.jQuery = function(argument) {
    return global.jQuery.jQuery_function(argument);
};
*/

// var index = require('../dist/index');
import jp_doodle_is_loaded from "../dist/index";

describe('testing my_plugin', () => {

    it('loads the index', () => {
        //expect(true).toEqual(true);
        expect(jp_doodle_is_loaded()).toBe(true);
    });

  });
