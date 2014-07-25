var assert = require("assert");
var APP_CONFIG = require("../config").APP_CONFIG;
var PushNotificationsDB = require("../model/postgres/push_notifications_db.js");

var TEST_CONFIG = require("./test_config").TEST_CONFIG;

describe('PushNotificationsDB', function() {

	var userUUID = TEST_CONFIG["user_uuid"];
	var appName = TEST_CONFIG["app"];
	var db_env = TEST_CONFIG["db_env"];
	var myConfig = APP_CONFIG[appName];
	var connectString = myConfig[db_env];


	var pushDb = PushNotificationsDB.createInstance(appName, connectString);

	var pushObj1 = pushDb.createPushNotificationObject(null,  appName, "sent",  "ios", "y", "gt,30", "gte,10", "achan", "20,10", 0, "message 1", "tcode1", "", "", "", "", null, "");

	var pushObj2 = pushDb.createPushNotificationObject(null,  appName, "unsent",  "ios", "n", "", "", "", "",  0, "message 1", "tcode2", "qqwer", "", "", "", null, "");

	var pushObj3 = pushDb.createPushNotificationObject(null,  appName, "unsent",  "ios", "y", "", "", "", "",  0, "message 1", "tcode3", "asdf", "", "", "", null, "");


	before(function(done) {
		pushDb.testClearDatabase(function(err, result) {
			done();
		});
	});


	// find missing object
	describe('#cantfindOne', function(){
		it('should return null/error on find one', function(done){

			pushDb.findOne(6666666, function(err, result) {
				assert.equal(null, result, "result not equal null");
				done();
			});

		})
	});

	// update missing object

	describe('#updateMissing', function(){
		it('should return error when updating a missing obj', function(done){

			pushDb.updatePushNotificationObject(pushObj1, function(err, result) {
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

			pushDb.savePushNotificationObject(pushObj1, function(err, result) {
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

			pushDb.savePushNotificationObject(pushObj2, function(err, result) {
				if(err) {
					done();
					return;
				}

				pushDb.savePushNotificationObject(pushObj3, function(err, result) {
					if(err) {
						done();
						return;
					}

					assert.equal(null, err, "err not equal null");
					assert.notEqual(null, result, "result equal null");
					assert.equal(true, result.rowCount >= 1, "result.rowcount not exist or is 0");

					done();


				});  // savePushNotificationObject

			});  // savePushNotificationObject



		})
	});


});//describe