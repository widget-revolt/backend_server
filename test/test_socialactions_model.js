var assert = require("assert");
var APP_CONFIG = require("../config").APP_CONFIG;
var SocialActionsDB = require("../model/postgres/social_actions_db.js");

var TEST_CONFIG = require("./test_config").TEST_CONFIG;

describe('SocialActionsDB', function() {

	var userUUID = TEST_CONFIG["user_uuid"];
	var appName = TEST_CONFIG["app"];
	var db_env = TEST_CONFIG["db_env"];
	var myConfig = APP_CONFIG[appName];
	var connectString = myConfig[db_env];


	var socialDb = SocialActionsDB.createInstance(appName, connectString);

	var userSocialId = "6671";
	var actionObj1 = socialDb.createSocialActionObject(null, appName, null, "active", userUUID,userSocialId, "friend777", "invite", "tickets", 1000);

	var actionObj2 = socialDb.createSocialActionObject(null, appName, null, "inactive", userUUID, userSocialId,"friend778", "invite", "tickets", 1000,"murray", "franken");

	var actionObj3 = socialDb.createSocialActionObject(null, appName, null, "active", userUUID, userSocialId,"friend779", "gift", "tokens", 10,"murray", "franken");

	var actionObj4 = socialDb.createSocialActionObject(null, appName, null, "claimed", userUUID, userSocialId,"friend780", "invite", "tickets", 1000,"murray", "franken");

	before(function(done) {
		socialDb.testClearDatabase(function(err, result) {
			done();
		});
	});


	// find missing object
	describe('#cantfindOne', function(){
		it('should return null/error on find one', function(done){

			socialDb.findOne(6666666, function(err, result) {
				assert.equal(null, result, "result not equal null");
				done();
			});

		})
	});

	// update missing object

	describe('#updateMissing', function(){
		it('should return error when updating a missing obj', function(done){

			socialDb.updateSocialActionObject(actionObj1, function(err, result) {
				assert.equal(null, err, "err equal null");
				assert.notEqual(null, result, "result equal null");
				assert.equal(0, result.rowCount, "result.rowcount not exist or is 0");

				done();
			});

		})
	});

	// insert object
	describe('#insert object', function(){
		it('should save object', function(done){

			socialDb.saveSocialActionObject(actionObj1, function(err, result) {
				assert.equal(null, err, "err not equal null");
				assert.notEqual(null, result, "result equal null");
				assert.equal(true, result.rowCount >= 1, "result.rowcount not exist or is 0");

				done();
			});

		})
	});

	// insert multiple
	describe('#insert multiple', function(){
		it('should insert multiple objects', function(done){

			socialDb.saveSocialActionObject(actionObj2, function(err, result) {
				if(err) {
					done();
					return;
				}

				socialDb.saveSocialActionObject(actionObj3, function(err, result) {
					if(err) {
						done();
						return;
					}

					socialDb.saveSocialActionObject(actionObj4, function(err, result) {
						if(err) {
							done();
							return;
						}

						assert.equal(null, err, "err not equal null");
						assert.notEqual(null, result, "result equal null");
						assert.equal(true, result.rowCount >= 1, "result.rowcount not exist or is 0");

						done();

					});  // savePromoBannerObject3



				});  // savePromoBannerObject2

			});  // savePromoBannerObject



		})
	});


});//describe