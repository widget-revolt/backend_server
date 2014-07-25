var assert = require("assert");

describe('Devices', function(){

	//TODO: clean device table

	describe('#indexOf()', function(){
		it('Should insert a device', function(){
			assert.equal(-1, [1,2,3].indexOf(5));
			assert.equal(-1, [1,2,3].indexOf(0));
		})
	})
});