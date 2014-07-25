backend_server
==============

Simple straightforward BaaS supporting wrbackend client lib 


About
================
This is a simple straightforward BaaS we put together for WR apps.  It has support for the following:
- User/device tracking with source install collection and push reg tracking
- Inventory and IAP support
- Custom client json storage per user.  Clients can store whatever they want per user (typically session count, last_played timestamp)
- Social actions for gifting and invite support
- Coupons for creating free IAP coupons per user
- Social leaderboard tracking for keeping track of friends scores per level
- App Config support
- Promotional Banner management for posting and managing rules on in-app promo (popup) banners
- Rudimentary push notification support.  Currently using Urban Airship for transport but will switch soon.  Composition can add analytics tracking codes and references to other app ids.

