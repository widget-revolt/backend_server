
var assert = require("assert");
var APP_CONFIG = require("../config").APP_CONFIG;
var ServerConfig = require("../config").ServerConfig;
var PromoBannerDb = require("../model/postgres/promo_banners_db.js");

var TEST_CONFIG = require("./test_config").TEST_CONFIG;

describe('PromoBannerDB', function(){

	var appName = TEST_CONFIG["app"];
	var db_env = TEST_CONFIG["db_env"];
	var myConfig = APP_CONFIG[appName];
	var connectString = myConfig[db_env];


	var promoBannerDb = PromoBannerDb.createInstance(appName, connectString);


	before(function(done){
		promoBannerDb.testClearDatabase(function(err, result){
			done();
		});
	});


	var promoObj = promoBannerDb.createPromoBannerObject(null, appName, "test1", "active", "", "both", 0, "these are notes", "", 0, "", "", null, null, "title str", "message str", "media_url", "banner action", "banner arg1", "bannerarg2");

	var promoObj2 = promoBannerDb.createPromoBannerObject(null, appName, "test2", "inactive", "", "both", 0, "these are notes", "y", 0, "f", "", null, null, "rules", "title str", "message str", "media_url", "banner action", "banner arg1", "bannerarg2");

	var startDate = new Date();

	var endDate = new Date();
	endDate.setDate(endDate.getDate() + 7);

	var promoObj3 = promoBannerDb.createPromoBannerObject(null, appName, "test3","active", "", "both", 0, "these are notes",  "", 69, "", "", startDate, endDate,"rules", "title str", "message str", "media_url", "banner action", "banner arg1", "bannerarg2");


	// find missing object
	describe('#cantfindOne', function(){
		it('should return null/error on find one', function(done){

			promoBannerDb.findOne(666, function(err, result) {
				assert.equal(null, result, "result not equal null");
				done();
			});

		})
	});

	// update missing object

	describe('#updateMissing', function(){
		it('should return error when updating a missing obj', function(done){

			promoBannerDb.updatePromoBannerObject(promoObj, function(err, result) {
				assert.equal(null, err, "err equal null");
				assert.notEqual(null, result, "result equal null");
				assert.equal(0, result.rowCount, "result.rowcount not exist or is 0");

				done();
			});

		})
	});


	// insert object
	describe('#insertObject', function(){
		it('should save object', function(done){

			promoBannerDb.savePromoBannerObject(promoObj, function(err, result) {
				assert.equal(null, err, "err not equal null");
				assert.notEqual(null, result, "result equal null");
				assert.equal(true, result.rowCount >= 1, "result.rowcount not exist or is 0");

				done();
			});

		})
	});

	// find inserted
	var foundObject = null;
	describe('#findOneByName', function(){
		it('should find one object by name', function(done){

			promoBannerDb.findOneByName("test1", function(err, result) {
				assert.equal(null, err, "err not equal null");
				assert.notEqual(null, result, "result equal null");

				foundObject = result;

				done();
			});

		})
	});


	// update object - this has a dependency on foundObject working
	describe('#update 1 object', function(){
		it('should save object', function(done){

			promoObj["uid"] = foundObject["uid"];
			promoObj["notes"] = "_UPDATED_";

			promoBannerDb.savePromoBannerObject(promoObj, function(err, result) {
				assert.equal(null, err, "err not equal null");
				assert.notEqual(null, result, "result equal null");
				assert.equal(true, result.rowCount >= 1, "result.rowcount not exist or is 0");

				if(err || !result) {
					done();
					return;
				}

				// find it again
				promoBannerDb.findOneByName("test1", function(err, result) {
					assert.equal(null, err, "err not equal null");
					assert.notEqual(null, result, "result equal null");

					assert.equal("_UPDATED_", result["notes"]);

					done();
				});


			});

		})
	});



	// find active
	describe('#getActivePromoJSON', function(){
		it('should find two objects', function(done){

			promoBannerDb.savePromoBannerObject(promoObj2, function(err, result) {
				if(err) {
					done();
					return;
				}

				promoBannerDb.savePromoBannerObject(promoObj3, function(err, result) {
					if(err) {
						done();
						return;
					}

					promoBannerDb.getActivePromoJSON(function(err, result) {
						assert.equal(null, err, "err not equal null");
						assert.notEqual(null, result, "result equal null");

						assert.equal(2, result.length, "result length != 2");

						done();
					});

				});  // savePromoBannerObject2

			});  // savePromoBannerObject



		})
	});


});