
var assert = require("assert");

var request = require('request');

var APP_CONFIG = require("../config").APP_CONFIG;
var ServerConfig = require("../config").ServerConfig;
var PromoBannerDb = require("../model/postgres/promo_banners_db.js");
var UserDb = require("../model/postgres/users_db.js");
var ClientUsersDb = require("../model/postgres/client_users_db.js");
var DevicesDb = require("../model/postgres/devices_db.js");
var TransactionsDb = require("../model/postgres/transactions_db.js");
var SocialActionsDb = require("../model/postgres/social_actions_db.js");

var TEST_CONFIG = require("./test_config").TEST_CONFIG;



// clear my test users, devices, client_users, transactions, and social_actions explicityly by id

// register_user, invalid auth
function cleanDatabases(callback)
{
	var appName = TEST_CONFIG["app"];
	var db_env = TEST_CONFIG["db_env"];
	var myConfig = APP_CONFIG[appName];
	var connectString = myConfig[db_env];

	var userDb = UserDb.createInstance(appName, connectString);
	var clientUserDb = ClientUsersDb.createInstance(appName, connectString);
	var devicesDb = DevicesDb.createInstance(appName, connectString);
	var transactionsDb = TransactionsDb.createInstance(appName, connectString);
	var socialActionsDb = SocialActionsDb.createInstance(appName, connectString);

	userDb.testAPIClearDatabase("666", function(err, result) {

		clientUserDb.testAPIClearDatabase("666", function(err, result) {
			devicesDb.testAPIClearDatabase("666", function(err, result) {
				transactionsDb.testAPIClearDatabase("666", function(err, result) {
					socialActionsDb.testAPIClearDatabase("666", function(err, result) {

						callback();
					});
				});
			});
		});
	});

}

describe('api', function(){

	var appName = TEST_CONFIG["app"];
	var db_env = TEST_CONFIG["db_env"];
	var myConfig = APP_CONFIG[appName];
	var connectString = myConfig[db_env];

	var userDb = UserDb.createInstance(appName, connectString);
	var clientUserDb = ClientUsersDb.createInstance(appName, connectString);
	var devicesDb = DevicesDb.createInstance(appName, connectString);
	var transactionsDb = TransactionsDb.createInstance(appName, connectString);
	var socialActionsDb = SocialActionsDb.createInstance(appName, connectString);

	var kRequestOptions = {
		"apiserver": "http://" + TEST_CONFIG["api_server"] + "/" + appName,
		"method": "POST",
		"form": {}

	};

	before(function(done){

		cleanDatabases(function() {
			done();
		});

		//TODO:

	});


	// test register user
	describe('/register_user', function(){

		// invalid auth
		it('should not register user due to bad auth', function(done){

			var formData = getStandardUserParams();
			formData["auth"] = "foobar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/register_user", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});
		});

		it('should register user', function(done){

			var formData = getStandardUserParams();
			var requestOpt = getTestURLOptions("/register_user", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				done();
			});

		});
	});

	//-----------------------------------------------------------------
	// test add install info
	describe('/add_user_install_info', function(){

		// invalid auth
		it('should not add install info due to bad auth', function(done){

			var formData = getStandardUserParams();
			formData["auth"] = "foobar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/add_user_install_info", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});
		});

		it('should add two pieces of install info', function(done){

			var formData = getStandardUserParams();
			formData["install_tracker_id"] = "test_tracker_id";
			formData["install_tracker_name"] = "TESTinstall_tracker_name";
			var requestOpt = getTestURLOptions("/add_user_install_info", kRequestOptions, formData);

			var userUUID = TEST_CONFIG["user_uuid"];

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				// fetch the object and check
				userDb.findOne(userUUID, function(err, result) {

					assert.equal(null, error, "error not equal null" + error);
					assert.notEqual(null, result, "result is null");

					// make sure we have data for our two pieces
					assert.equal("test_tracker_id", result["install_tracker_id"], "install tracker id not correct");
					assert.equal("TESTinstall_tracker_name", result["install_tracker_name"], "install tracker id not correct");

					done();

				});


			});

		});

		it('should add two pieces of install info', function(done){

			var formData = getStandardUserParams();
			var userUUID = TEST_CONFIG["user_uuid"];

			// change this info
			formData["install_tracker_id"] = "test_tracker_id2";
			formData["install_tracker_name"] = "TESTinstall_tracker_name2";
			formData["install_referrer"] = "TESTreferrer";
			formData["install_referrer_ip"] = "TESTreferrerIp";
			var requestOpt = getTestURLOptions("/add_user_install_info", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				// fetch the object and check
				userDb.findOne(userUUID, function(err, result) {

					assert.equal(null, error, "error not equal null" + error);
					assert.notEqual(null, result, "result is null");

					// make sure we have data for our two pieces
					assert.equal("test_tracker_id2", result["install_tracker_id"], "install tracker id not correct");
					assert.equal("TESTinstall_tracker_name2", result["install_tracker_name"], "install tracker id not correct");
					assert.equal("TESTreferrer", result["install_referrer"], "install tracker id not correct");
					assert.equal("TESTreferrerIp", result["install_referrer_ip"], "install tracker id not correct");

					done();

				});

			});

		});//it()
	});

	//-----------------------------------------------------------------
	// send_facebook gifts
	describe('/send_facebook_gifts', function(){

		before(function(done){

			var socialActionsDb = SocialActionsDb.createInstance(appName, connectString);
			socialActionsDb.testClearDatabase(function(err, result) {
				done();
			});

		});

		it('should not work due to bad auth', function(done){

			var formData = {};
			formData["uid"] = "foo";
			formData["auth"] = "bar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});

		it('should not work due to missing params', function(done){

			var formData = getStandardUserParams();
			var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});

		// /send_facebook_gifts to new users
		it('should send gifts to new users', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "666666666";
			formData["fb_id_list"] = "6670,6680,10560,10570,10580,10590,10600,10610"; // 8 items
			formData["request_type"] = "gift";
			formData["fname"] = "murry";
			formData["lname"] = "franken";
			var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result should be ok");
				assert.equal(8, jsonObj["data"]["gifts_sent"], "should have sent 8 gifts");

				done();
			});

		});

		// /send_facebook_gifts to new users
		it('should send 2 life to new users', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "666666666";
			formData["fb_id_list"] = "6670,6680"; // 8 items
			formData["request_type"] = "life";
			formData["fname"] = "murry";
			formData["lname"] = "franken";
			var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result should be ok");
				assert.equal(2, jsonObj["data"]["gifts_sent"], "should have sent 2 lives");

				done();
			});

		});

		// /send_facebook_gifts to new users
		it('should update 7 users - one user under 24 hour limit', function(done){


			// update the database by changing the date_update
			var socialActionsDb = SocialActionsDb.createInstance(appName, connectString);
			var queryStr = "UPDATE social_actions SET date_update=$1 WHERE friend_id <> $2";
			var queryParams = [new Date("2014-01-01"), "6670"];
			socialActionsDb.testUpdateQuery(queryStr, queryParams, function(err, result) {

				assert.equal(null, err, "error prepping social_action db for update test");

				var formData = getMinimalUserParams();
				formData["user_social_id"] = "666666666";
				formData["fb_id_list"] = "6670,6680,10560,10570,10580,10590,10600,10610"; // 8 items
				formData["request_type"] = "gift";
				formData["fname"] = "murry";
				formData["lname"] = "franken";
				var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

				request(requestOpt, function (error, response, body) {

					assert.equal(null, error, "error not equal null" + error);
					assert.equal(200, response.statusCode);
					var jsonObj = safeParseBody(body);
					var result = jsonObj["result"];

					// we should only have 7 updates now
					assert.notEqual(null, result, "result is null");
					assert.equal("ok", result, "result should be ok");
					assert.equal(7, jsonObj["data"]["gifts_sent"], "should have sent 7 gifts");

					done();
				});
			});

		});


	});

	//----------------------------------------------------------
	// get gifts
	describe('/get_available_facebook_gifts', function(){

		it('should not work due to bad auth', function(done){

			var formData = {};
			formData["uid"] = "foo";
			formData["auth"] = "bar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/get_available_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});

		it('should not work due to missing params', function(done){

			var formData = getStandardUserParams();
			var requestOpt = getTestURLOptions("/get_available_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});


		it('should get 1 life 1 gift (2 gifts)', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "6670";
			var requestOpt = getTestURLOptions("/get_available_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result should be ok");
				assert.equal(2, jsonObj["data"].length, "should have  1 gifts");

				done();
			});

		});

		// insert two records to target, one active and one inactive.  We should get 2
		it('should get 3 total gifts', function(done){

			// update the database by changing the date_update
			var socialActionsDb = SocialActionsDb.createInstance(appName, connectString);



			var actionObj1 = socialActionsDb.createSocialActionObject(null, appName, null, "inactive", "6671","6671", "6670", "gift", "", 0);
			var actionObj2 = socialActionsDb.createSocialActionObject(null, appName, null, "active", "6672","6672", "6670", "gift", "", 0, "g. Ray", "Fische");

			socialActionsDb.saveSocialActionObject(actionObj1, function(err, result) {

				assert.equal(null, err, "error prepping social_action db for update test");

				socialActionsDb.saveSocialActionObject(actionObj2, function(err, result) {

					assert.equal(null, err, "error prepping social_action db for update test");

					var formData = getMinimalUserParams();
					formData["user_social_id"] = "6670";
					var requestOpt = getTestURLOptions("/get_available_facebook_gifts", kRequestOptions, formData);

					request(requestOpt, function (error, response, body) {

						assert.equal(null, error, "error not equal null" + error);
						assert.equal(200, response.statusCode);
						var jsonObj = safeParseBody(body);
						var result = jsonObj["result"];

						// we should only have 7 updates now
						assert.notEqual(null, result, "result is null");
						assert.equal("ok", result, "result should be ok");
						assert.equal(3, jsonObj["data"].length, "should have 3 (2 gifts + 1 life)");

						done();
					});  //request
				});//saveSocialActionObject

			});//saveSocialActionObject

		});//it




	});//describe(get_available_facebook_gifts)


	//----------------------------------------------------------
	// claim gifts
	describe('/claim_facebook_gifts', function(){

		it('should not work due to bad auth', function(done){

			var formData = {};
			formData["uid"] = "foo";
			formData["auth"] = "bar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/claim_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});

		it('should not work due to missing params', function(done){

			var formData = getStandardUserParams();
			var requestOpt = getTestURLOptions("/claim_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});

		});

		// because of previous test - we should have 2 available
		it('should claim 2 gifts', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "6670";
			formData["request_type"] = "gift";
			var requestOpt = getTestURLOptions("/claim_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result should be ok");
				assert.equal(2, jsonObj["data"]["count"], "should have claimed 2 gifts");

				done();
			});

		});

		// we should not have any active gifts now
		it('should claim 0 gifts', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "6670";
			formData["request_type"] = "life";
			var requestOpt = getTestURLOptions("/claim_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result should be ok");
				assert.equal(1, jsonObj["data"]["count"], "should have claimed 1 gifts");

				done();
			});

		});//it

		// /send_facebook_gifts to new users
		it('should send 2 lifes to 6680 user and claim', function(done){

			var formData = getMinimalUserParams();
			formData["user_social_id"] = "666666666";
			formData["fb_id_list"] = "6680"; // 8 items
			formData["request_type"] = "life";
			formData["fname"] = "murry";
			formData["lname"] = "franken";
			var requestOpt = getTestURLOptions("/send_facebook_gifts", kRequestOptions, formData);

			request(requestOpt, function (err, response, body) {

				assert.equal(null, err, "error prepping social_action db for update test");

				formData["user_social_id"] = "666666661";
				request(requestOpt, function (err, response, body) {

					assert.equal(null, err, "error prepping social_action db for update test");

					var formData = getMinimalUserParams();
					formData["user_social_id"] = "6680";
					formData["request_type"] = "life";
					var requestOpt = getTestURLOptions("/claim_facebook_gifts", kRequestOptions, formData);

					request(requestOpt, function (error, response, body) {

						assert.equal(null, error, "error not equal null" + error);
						assert.equal(200, response.statusCode);
						var jsonObj = safeParseBody(body);
						var result = jsonObj["result"];

						assert.notEqual(null, result, "result is null");
						assert.equal("ok", result, "result should be ok");
						assert.equal(2, jsonObj["data"]["count"], "should have claimed 1 gifts");

						done();
					});

				});
			});

		});


	});//describe(get_available_facebook_gifts)

	//--------------------------------------------------------
	// devices
	describe('/register_device', function(){

		before(function(done){

			var deviceDb = DevicesDb.createInstance(appName, connectString);
			deviceDb.testClearDatabase(function(err, result) {
				done();
			});

		});


		// invalid auth
		it('should not register user due to bad auth', function(done){

			var formData = getStandardDeviceParams();
			formData["auth"] = "foobar"; //<== this is incorrect
			var requestOpt = getTestURLOptions("/register_device", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("err_invalid_param", result, "result is ok and should not be");

				done();
			});
		});

		it('should register device - missing some params', function(done){

			var formData = getStandardDeviceParams();
			var requestOpt = getTestURLOptions("/register_device", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				done();
			});

		});

		it('should register device2 - with more params', function(done){

			var formData = getStandardDeviceParams();
			var userData = getMinimalUserParams2();

			formData["uuid"] = userData["uuid"];
			formData["auth"] = userData["auth"];
			formData["apid"] = "bogusapid";
			formData["push_tags"] = "tag1";

			var requestOpt = getTestURLOptions("/register_device", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				done();
			});

		});

		it('should update device 2 with different tags', function(done){

			var formData = getStandardDeviceParams();
			var userData = getMinimalUserParams2();

			var theUUID = userData["uuid"];
			formData["uuid"] = userData["uuid"];
			formData["auth"] = userData["auth"];
			formData["apid"] = "bogusapid";
			formData["push_tags"] = "tag1|tag2";
			var requestOpt = getTestURLOptions("/register_device", kRequestOptions, formData);

			request(requestOpt, function (error, response, body) {

				assert.equal(null, error, "error not equal null" + error);
				assert.equal(200, response.statusCode);
				var jsonObj = safeParseBody(body);
				var result = jsonObj["result"];

				assert.notEqual(null, result, "result is null");
				assert.equal("ok", result, "result is not ok");

				// almost good but lets verify the actual content on this device
				var deviceDb = DevicesDb.createInstance(appName, connectString);
				deviceDb.findOne(theUUID, "my_vendor_id", function(err, result) {

					assert.equal(null, error, "error not equal null" + err);
					assert.notEqual(null, result, "result not null" + err);

					var foundObj = result;
					assert.equal(foundObj["user_uuid"], theUUID, "UUID not correct");
					assert.equal(foundObj["push_tags"], "tag1|tag2", "push tags not equal");

					done();
				})// findOne


			});

		});
	});

	//TODO: ios IAP verification

	//TODO: android IAP verification

	//TODO: inventory

	//TODO: test set/get client user info


	//TODO: test leaderboard

	//TODO: test coupon

	//TODO: test promobanners





});

function safeParseBody(body)
{
	console.log(body);

	var jsonObj = { "result": "err_null_body" };
	try {
		jsonObj = JSON.parse(body);
	}
	catch(e) {
		jsonObj = { "result": "err_null_body" };
	}

	return jsonObj;
}

function getTestURLOptions(inResource, inOptions, inFormData)
{
	var requestOpt = inOptions;
	requestOpt["url"] = requestOpt["apiserver"] + inResource;
	requestOpt["form"] = inFormData || {};

	return requestOpt;
}

function getMinimalUserParams() {
	var testUserUUID = TEST_CONFIG["user_uuid"];
	var testUserHash = TEST_CONFIG["uuid_hash"];

	var user = {
		"uuid": testUserUUID,
		"auth" : testUserHash
	};

	return user;
}


function getMinimalUserParams2() {
	var testUserUUID = "667";
	var testUserHash = "97f0e2775ce64b9ca1a51a200ce4c9793078027669abf4c21155187cf6db882e";

	var user = {
		"uuid": testUserUUID,
		"auth" : testUserHash
	};

	return user;
}

function getStandardUserParams()
{
	var testUserUUID = TEST_CONFIG["user_uuid"];
	var testUserHash = TEST_CONFIG["uuid_hash"];

	var user = {

		"odin": "test_odin",
		"uuid": testUserUUID,
		"auth" : testUserHash,
		"asid" : "test_asid",
		"fbid" : "",
		"fname" : "",
		"lname" : "",
		"email" : "",
		"bday" : "",
		"sexa" : "",
		"platform" : "ios",
		"osvers" : "6.1",
		"device" : "client test page",
		"carrier" : "Carrier",
		"mcc" : "311",
		"mnc" : "444",
		"idfv": "my vendor id",
		"gc_id": "gamecenterID6",
		"gc_alias": "gamecenterAlias6",
		"gpg_id": "gpguser2",
		"gpg_alias": "gpgalias2"
	};

	return user;
}

function getStandardDeviceParams()
{
	var device = {


		"auth" : "2c4fb01aff59afd3a58fdd98db3257414a5e71303bc3473634e355ecff8af9c5",

		"uuid": "666",
		"device_id": "my_vendor_id",
		"apns_token" : "112233445566",
		"language" : "english",
		"country" : "US",
		"time_zone" : -8,
		"platform" : "ios",
		"osvers" : "7.0",
		"device" : "iPhone",
		"carrier" : "BigTelco",
		"mcc" : "311",
		"mnc" : "444",
		"imei": ""
	};

	return device;
}