-- Auto-generated seed data from backup
-- Schema: post-0014_poi_normalization (new table/column names)
-- Usage: npx wrangler d1 execute trip-planner-db-staging --remote --file migrations/seed.sql

-- trips
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('banqiao-trip-2026-Onion','Onion 的板橋之旅','Onion','2026 板橋十五日在地行程表',1,'TW',1,'2026-04-01, 2026-04-02, 2026-04-03, 2026-04-04, 2026-04-05, 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10, 2026-04-11, 2026-04-12, 2026-04-13, 2026-04-14, 2026-04-15','{"title":"2026 板橋十五日行程","dates":"4/1（三）~ 4/15（三）","budget":"","exchangeNote":"","tagline":"新北在地生活！探索家附近的好去處！"}',0);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('busan-trip-2026-CeliaDemyKathy','三姊妹的釜山之旅','CeliaDemyKathy','2026 釜山五天四夜三姊妹之旅',0,'KR',1,'2026-03-20, 2026-03-21, 2026-03-22, 2026-03-23, 2026-03-24','{"title":"2026 釜山五天四夜三姊妹之旅","dates":"3/20（五）~ 3/24（二）","budget":"","exchangeNote":"匯率以 1 KRW ≈ 0.025 TWD 估算｜實際費用依當時匯率及消費為準","tagline":"부산에 오이소! 三姊妹釜山行，開始！"}',0);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('kyoto-trip-2026-MimiChu','咪咪醬的京都之旅','MimiChu','2026 京都六日咪咪醬初體驗行程表',0,'JP',1,'2026-03-06, 2026-03-07, 2026-03-08, 2026-03-09, 2026-03-10, 2026-03-11','{"title":"2026 京都咪咪醬初體驗","dates":"3/6（五）~ 3/11（三）","budget":"","exchangeNote":"匯率以 1 JPY ≈ 0.22 TWD 估算｜實際費用依當時匯率及消費為準","tagline":"おこしやす 京都！ 祝旅途愉快！"}',0);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('okinawa-trip-2026-AeronAn','AeronAn 的沖繩之旅','AeronAn','2026 沖繩五日大眾交通之旅',0,'JP',1,'2026-04-24, 2026-04-25, 2026-04-26, 2026-04-27, 2026-04-28','{"title":"2026 沖繩五日大眾交通之旅","dates":"4/24（五）~ 4/28（二）","budget":"","exchangeNote":"匯率以 1 JPY ≈ 0.22 TWD 估算｜實際費用依當時匯率及消費為準","tagline":"めんそーれ 沖繩！ 祝旅途愉快！"}',0);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('okinawa-trip-2026-HuiYun','Hui Yun 的沖繩之旅','HuiYun','2026 沖繩七日遊行程表',1,'JP',1,'2026-07-02, 2026-07-03, 2026-07-04, 2026-07-05, 2026-07-06, 2026-07-07, 2026-07-08','{"title":"2026 沖繩七日遊","dates":"7/2（四）~ 7/8（三）","budget":"","exchangeNote":"","tagline":"めんそーれ 沖繩！ 祝旅途愉快！"}',0);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('okinawa-trip-2026-Ray','Ray 的沖繩之旅','Ray','2026 沖繩五日自駕遊行程表',1,'JP',1,'2026-07-29, 2026-07-30, 2026-07-31, 2026-08-01, 2026-08-02','{"title":"2026 沖繩五日自駕遊","dates":"7/29（三）~ 8/2（日）","budget":"","exchangeNote":"匯率以 1 JPY ≈ 0.22 TWD 估算｜實際費用依當時匯率及消費為準","tagline":"めんそーれ 沖繩！ 祝旅途愉快！"}',1);
INSERT OR IGNORE INTO trips (id,name,owner,title,self_drive,countries,published,auto_scroll,footer,is_default) VALUES ('okinawa-trip-2026-RayHus','RayHus 的沖繩之旅','RayHus','2026 沖繩六日輕旅遊行程表',0,'JP',1,'2026-03-06, 2026-03-07, 2026-03-08, 2026-03-09, 2026-03-10, 2026-03-11','{"title":"2026 沖繩六日輕旅遊","dates":"3/6（五）~ 3/11（三）","budget":"","exchangeNote":"匯率以 1 JPY ≈ 0.22 TWD 估算｜實際費用依當時匯率及消費為準","tagline":"めんそーれ 沖繩！ 祝旅途愉快！"}',0);

-- trip_days (was: days) — weather_json dropped
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (51,'banqiao-trip-2026-Onion',1,'2026-04-01','三','板橋');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (52,'banqiao-trip-2026-Onion',2,'2026-04-02','四','板橋');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (53,'banqiao-trip-2026-Onion',3,'2026-04-03','五','板橋');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (54,'banqiao-trip-2026-Onion',4,'2026-04-04','六','新莊・三重');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (55,'banqiao-trip-2026-Onion',5,'2026-04-05','日','新莊・三重');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (56,'banqiao-trip-2026-Onion',6,'2026-04-06','一','新莊・三重');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (57,'banqiao-trip-2026-Onion',7,'2026-04-07','二','中和・永和');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (58,'banqiao-trip-2026-Onion',8,'2026-04-08','三','中和・永和');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (59,'banqiao-trip-2026-Onion',9,'2026-04-09','四','中和・永和');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (60,'banqiao-trip-2026-Onion',10,'2026-04-10','五','土城・樹林');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (61,'banqiao-trip-2026-Onion',11,'2026-04-11','六','土城・樹林');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (62,'banqiao-trip-2026-Onion',12,'2026-04-12','日','土城・樹林');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (63,'banqiao-trip-2026-Onion',13,'2026-04-13','一','淡水・八里');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (64,'banqiao-trip-2026-Onion',14,'2026-04-14','二','淡水・八里');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (65,'banqiao-trip-2026-Onion',15,'2026-04-15','三','淡水・八里');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (66,'busan-trip-2026-CeliaDemyKathy',1,'2026-03-20','五','西面・汗蒸');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (67,'busan-trip-2026-CeliaDemyKathy',2,'2026-03-21','六','甘川洞・松島');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (68,'busan-trip-2026-CeliaDemyKathy',3,'2026-03-22','日','機張・廣安里');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (69,'busan-trip-2026-CeliaDemyKathy',4,'2026-03-23','一','海雲台・青沙埔');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (70,'busan-trip-2026-CeliaDemyKathy',5,'2026-03-24','二','南浦洞・返台');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (71,'kyoto-trip-2026-MimiChu',1,'2026-03-06','五','抵達京都');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (72,'kyoto-trip-2026-MimiChu',2,'2026-03-07','六','宇治一日遊');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (73,'kyoto-trip-2026-MimiChu',3,'2026-03-08','日','鴨川・錦市場');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (74,'kyoto-trip-2026-MimiChu',4,'2026-03-09','一','金閣寺・壽喜燒');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (75,'kyoto-trip-2026-MimiChu',5,'2026-03-10','二','稻荷・清水寺');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (76,'kyoto-trip-2026-MimiChu',6,'2026-03-11','三','返回台北');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (77,'okinawa-trip-2026-AeronAn',1,'2026-04-24','五','抵達那霸');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (78,'okinawa-trip-2026-AeronAn',2,'2026-04-25','六','南部遺產');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (79,'okinawa-trip-2026-AeronAn',3,'2026-04-26','日','北部水族館');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (80,'okinawa-trip-2026-AeronAn',4,'2026-04-27','一','中部巡遊');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (81,'okinawa-trip-2026-AeronAn',5,'2026-04-28','二','回程');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (82,'okinawa-trip-2026-HuiYun',1,'2026-07-02','四','那霸');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (83,'okinawa-trip-2026-HuiYun',2,'2026-07-03','五','浦添・美國村');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (84,'okinawa-trip-2026-HuiYun',3,'2026-07-04','六','殘波岬・萬座毛');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (85,'okinawa-trip-2026-HuiYun',4,'2026-07-05','日','美麗海・古宇利');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (86,'okinawa-trip-2026-HuiYun',5,'2026-07-06','一','來客夢・國際通');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (87,'okinawa-trip-2026-HuiYun',6,'2026-07-07','二','牧志・瀨長島');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (88,'okinawa-trip-2026-HuiYun',7,'2026-07-08','三','回程');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (89,'okinawa-trip-2026-Ray',1,'2026-07-29','三','北谷');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (90,'okinawa-trip-2026-Ray',2,'2026-07-30','四','浮潛・瀨底');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (91,'okinawa-trip-2026-Ray',3,'2026-07-31','五','水族館・古宇利');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (92,'okinawa-trip-2026-Ray',4,'2026-08-01','六','來客夢');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (93,'okinawa-trip-2026-Ray',5,'2026-08-02','日','首里城');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (94,'okinawa-trip-2026-RayHus',1,'2026-03-06','五','抵達那霸');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (95,'okinawa-trip-2026-RayHus',2,'2026-03-07','六','KKday一日遊');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (96,'okinawa-trip-2026-RayHus',3,'2026-03-08','日','Klook一日遊');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (97,'okinawa-trip-2026-RayHus',4,'2026-03-09','一','換飯店・來客夢');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (98,'okinawa-trip-2026-RayHus',5,'2026-03-10','二','iias 豐崎');
INSERT OR IGNORE INTO trip_days (id,trip_id,day_num,date,day_of_week,label) VALUES (99,'okinawa-trip-2026-RayHus',6,'2026-03-11','三','返台');

-- hotels (pre-POI migration — will become hotels_legacy after migrate-pois.js)
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (44,51,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (45,52,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (46,53,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (47,54,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (48,55,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (49,56,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (50,57,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (51,58,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (52,59,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (53,60,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (54,61,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (55,62,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (56,63,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (57,64,'家',NULL,'ai','新北板橋區合宜一路25號四樓之3','{"included":null}','',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (58,66,'Central Park Hotel Busan','12:00','ai','地址：釜山廣域市中區中央大路 33, 地鐵：南浦站 5 號出口步行 5 分鐘, 入住時間：15:00, 退房時間：12:00','{"included":false}','退房後行李可寄放櫃台，步行至南浦洞商圈非常方便',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (59,67,'Central Park Hotel Busan','12:00','ai',NULL,'{"included":false}','退房後行李可寄放櫃台，步行至南浦洞商圈非常方便',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (60,68,'Central Park Hotel Busan','12:00','ai',NULL,'{"included":false}','退房後行李可寄放櫃台，步行至南浦洞商圈非常方便',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (61,69,'Central Park Hotel Busan','12:00','ai',NULL,'{"included":false}','退房後行李可寄放櫃台，步行至南浦洞商圈非常方便',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (62,71,'Hotel Resol Trinity Kyoto','11:00','ai','〒604-0943 京都府京都市中京区上白山町249, TEL 075-211-9269','{"included":null}','地點極佳步行可達河原町與錦市場，退房後行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (63,72,'Hotel Resol Trinity Kyoto','11:00','ai',NULL,'{"included":null}','地點極佳步行可達河原町與錦市場，退房後行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (64,73,'Hotel Resol Trinity Kyoto','11:00','ai',NULL,'{"included":null}','地點極佳步行可達河原町與錦市場，退房後行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (65,74,'Hotel Resol Trinity Kyoto','11:00','ai',NULL,'{"included":null}','地點極佳步行可達河原町與錦市場，退房後行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (66,75,'Hotel Resol Trinity Kyoto','11:00','ai',NULL,'{"included":null}','地點極佳步行可達河原町與錦市場，退房後行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (67,77,'ダイワロイネットホテル那覇国際通り','11:00','ai','那覇市牧志1-1-2, 牧志站步行1分鐘, 國際通正中央，購物超方便','{"included":false,"note":"自助早餐 ¥2,200（6:30-10:00），需另付費"}','單軌牧志站出口直達，行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (68,78,'ダイワロイネットホテル那覇国際通り','11:00','ai','那覇市牧志1-1-2, 牧志站步行1分鐘','{"included":false,"note":"自助早餐 ¥2,200（6:30-10:00），需另付費"}','單軌牧志站出口直達，行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (69,79,'ダイワロイネットホテル那覇国際通り','11:00','ai','那覇市牧志1-1-2, 牧志站步行1分鐘','{"included":false,"note":"自助早餐 ¥2,200（6:30-10:00），需另付費"}','單軌牧志站出口直達，行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (70,80,'ダイワロイネットホテル那覇国際通り','11:00','ai','那覇市牧志1-1-2, 牧志站步行1分鐘','{"included":false,"note":"自助早餐 ¥2,200（6:30-10:00），需另付費"}','單軌牧志站出口直達，行李可寄放櫃台',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (77,89,'Vessel Hotel Campana Okinawa','11:00','ai','北谷美國村內, 步行 1 分到美國村, 頂樓海景溫泉, 含早餐（沖繩料理）','{"included":true,"note":"沖繩料理"}','頂樓露天溫泉可看海景夕陽，早餐沖繩料理種類豐富','{"price":"¥500/晚（先到先得）","note":"","maps":"北谷町営駐車場 美浜","mapcode":"33 525 382*00"}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (78,90,'Super Hotel 沖縄・名護','10:00','ai','名護市宮里（名護中心地段）, 万座深海の湯（天然温泉）, 免費停車場, 含免費早餐','{"included":true}','天然溫泉是萬座深海水，泡完很放鬆；早餐簡單但免費','{"price":"免費（先到先得）","note":"","maps":"スーパーホテル沖縄・名護","mapcode":"206 598 283*00"}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (79,91,'Super Hotel 沖縄・名護','10:00','ai','名護市宮里（名護中心地段）, 万座深海の湯（天然温泉）, 免費停車場, 含免費早餐','{"included":true}','連住第二晚，枕頭可向櫃台更換不同款式','{"price":"免費（先到先得）","note":"","maps":"スーパーホテル沖縄・名護","mapcode":"206 598 283*00"}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (80,92,'東橫inn 那霸國際通美榮橋站','10:00','ai','那霸美榮橋站旁, 走路 1 分到國際通, 含免費早餐, 單軌美榮橋站步行 1 分','{"included":true}','退房後行李可免費寄放櫃台，地點離單軌站超近很方便','{"price":"¥550/晚（先到先得）","note":"","maps":"東横INN那覇国際通り美栄橋駅 駐車場","mapcode":"33 157 382*00"}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (81,94,'Living Inn 旭橋駅前','10:00','ai','那霸市東町11-17, 旭橋站步行5分鐘, 近那霸巴士總站','{"included":false,"note":"不含早餐，附近便利商店或自行解決"}','旭橋站直結，拉行李方便；附近有辻スーパー可買宵夜',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (82,95,'Living Inn 旭橋駅前','10:00','ai','那霸市東町11-17, 旭橋站步行5分鐘','{"included":false,"note":"不含早餐，附近便利商店或自行解決"}','旭橋站直結，拉行李方便；附近有辻スーパー可買宵夜',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (83,96,'Living Inn 旭橋駅前','10:00','ai','那霸市東町11-17, 旭橋站步行5分鐘','{"included":false,"note":"不含早餐，附近便利商店或自行解決"}','旭橋站直結，拉行李方便；附近有辻スーパー可買宵夜',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (84,97,'THE NEST NAHA','11:00','ai','那霸市西1丁目6-1, 14F 溫水游泳池（9:00~22:00）, 那霸市西區','{"included":true,"note":"14F 泳池層自助早餐（沖繩料理為主）"}','14F 泳池可眺望那霸市景，建議傍晚回來後去游一下放鬆',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (85,98,'THE NEST NAHA','11:00','ai','那霸市西1丁目6-1, 14F 溫水游泳池（9:00~22:00）','{"included":true,"note":"14F 泳池層自助早餐（沖繩料理為主）"}','14F 泳池可眺望那霸市景，建議傍晚回來後去游一下放鬆',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (113,84,'HOPE VILLA Onnason','11:00','ai','沖縄県国頭郡恩納村名嘉真2288-702
TEL: 050-5433-6654
Web: https://hopevilla-onnason.com/
訂房來源：Booking.com','{"included":null}','獨棟Villa
有廚房可自炊',NULL);
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (114,82,'沖繩那霸美居飯店','11:00','ai','〒900-0025 沖縄県那覇市壺川3-3-19
TEL: 098-855-7111
Email: H8725-RE@accor.com
訂房來源：Trip.com','{"included":null}','深夜入住請事先確認自助Check in流程','{"price":"1泊 ¥1,000（税込）","note":"機械式立體停車場（升降機式），鑰匙交給櫃台。車輛限制：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下 — Alphard / Vellfire / RAV4 等大型車或高頂車無法停放。不可預約，先到先停；滿車時需自行找附近收費停車場。24小時可進出。附近替代：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。料金 60分 200円，24時間最大：平日 1,000円／假日 500円，24小時可入出庫","maps":"メルキュール沖縄那覇 駐車場","mapcode":null}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (115,83,'BUZZ RESORT Chatan','11:00','ai','〒904-0414 沖縄県国頭郡恩納村前兼久258
TEL: 098-982-5337
Web: https://www.buzz-resort.com/contact
訂房來源：Trip.com','{"included":null}','美浜美國村區域步行可達海灘','{"price":"費用未確認","note":"美浜美國村區域有免費停車場；BUZZ RESORT 請事先確認自用車停車方案","maps":"Buzz Resort Chatan 駐車場","mapcode":null}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (116,85,'HOPE VILLA Onnason','11:00','ai','沖縄県国頭郡恩納村名嘉真2288-702
TEL: 050-5433-6654
Web: https://hopevilla-onnason.com/
Day 3~4 連住
訂房來源：Booking.com','{"included":null}','Villa連住免搬行李
出發前確認冰箱食材','{"price":"免費","note":"HOPE VILLA 提供免費私人停車場（場地內停車）","maps":"HOPE VILLA Onnason","mapcode":null}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (117,86,'沖繩那霸美居飯店','11:00','ai','〒900-0025 沖縄県那覇市壺川3-3-19
TEL: 098-855-7111
Email: H8725-RE@accor.com
訂房來源：Trip.com','{"included":null}','回到那霸連住兩晚
可整理行李','{"price":"1泊 ¥1,000（税込）","note":"機械式立體停車場（升降機式），鑰匙交給櫃台。車限制：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下 — Alphard / Vellfire / RAV4 等大型車或高頂車無法停放。不可預約，先到先停；滿車時需自行找附近收費停車場。24小時可進出。附近替代：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。料金 60分 200円，24時間最大：平日 1,000円／假日 500円，24小時可入出庫","maps":"メルキュール沖縄那覇 駐車場","mapcode":null}');
INSERT OR IGNORE INTO hotels (id,day_id,name,checkout,source,description,breakfast,note,parking) VALUES (118,87,'沖繩那霸美居飯店','10:00','ai','〒900-0025 沖縄県那覇市壺川3-3-19
TEL: 098-855-7111
Email: H8725-RE@accor.com
Day 5~6 連住
訂房來源：Trip.com','{"included":null}','連住第二晚
今天要還車','{"price":"1泊 ¥1,000（税込）","note":"機械式立體停車場（升降機式），鑰匙交給櫃台。車輛限制：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下 — Alphard / Vellfire / RAV4 等大型車或高頂車無法停放。不可預約，先到先停；滿車時需自行找附近收費停車場。24小時可進出。附近替代：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。料金 60分 200円，24時間最大：平日 1,000円／假日 500円，24小時可入出庫","maps":"メルキュール沖縄那覇 駐車場","mapcode":null}');

-- trip_entries (was: entries) — body→description, rating→google_rating, location_json→location
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (189,51,0,'10:00-12:00','林本源園邸','國定古蹟，清代園林建築，板橋最具代表性的歷史景點','ai','林本源園邸',NULL,4.4,'園區免費參觀，定時導覽解說值得參加','car','開車 約15分鐘',15,'[{"name":"林本源園邸","googleQuery":"https://www.google.com/maps/search/%E6%9E%97%E6%9C%AC%E6%BA%90%E5%9C%92%E9%82%B8","appleQuery":"https://maps.apple.com/?q=%E6%9E%97%E6%9C%AC%E6%BA%90%E5%9C%92%E9%82%B8","lat":25.0082,"lng":121.4621,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (190,51,1,'12:00-13:00','午餐',NULL,'ai','板橋府中商圈',NULL,4.1,'高記週一公休注意，黃石市場午後收攤建議早點去',NULL,NULL,NULL,'[{"name":"板橋府中商圈","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","lat":25.0128,"lng":121.4636,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (191,51,2,'14:00-16:00','板橋435藝文特區','藝術展覽空間、溼地故事館，適合散步拍照的文創園區','ai','板橋435藝文特區',NULL,4.2,'免費入園，週一休館，適合親子同遊','car','開車 約10分鐘',10,'[{"name":"板橋435藝文特區","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B435%E8%97%9D%E6%96%87%E7%89%B9%E5%8D%80","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B435%E8%97%9D%E6%96%87%E7%89%B9%E5%8D%80","lat":25.0194,"lng":121.4689,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (192,51,3,'18:00-19:30','晚餐',NULL,'ai','板橋府中商圈',NULL,4.1,'懸日拉麵常排隊建議提早到，老味噌居酒屋適合晚餐小酌',NULL,NULL,NULL,'[{"name":"板橋府中商圈","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","lat":25.0128,"lng":121.4636,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (193,52,0,'10:00-12:00','板橋車站商圈','環球購物中心、板橋大遠百，三鐵共構的板橋交通樞紐商圈','ai','板橋車站',NULL,4.1,'大遠百與環球購物中心皆有地下連通道直通捷運站','car','開車 約10分鐘',10,'[{"name":"板橋車站","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99","lat":25.0143,"lng":121.4633,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (194,52,1,'12:00-13:00','午餐',NULL,'ai','板橋車站商圈',NULL,4.1,'好呷拉麵可無限續麵CP值高，涓豆腐小菜吃到飽',NULL,NULL,NULL,'[{"name":"板橋車站商圈","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99%E5%95%86%E5%9C%88","lat":25.0143,"lng":121.4633,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (195,52,2,'14:00-16:00','新板特區','新北市政府周邊，萬坪都會公園、市民廣場，現代化都市景觀','ai','新板特區萬坪都會公園',NULL,4.2,'萬坪公園傍晚散步很舒服，市民廣場假日常有市集活動','car','開車 約5分鐘',5,'[{"name":"新板特區萬坪都會公園","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E6%9D%BF%E7%89%B9%E5%8D%80%E8%90%AC%E5%9D%AA%E9%83%BD%E6%9C%83%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E6%9D%BF%E7%89%B9%E5%8D%80%E8%90%AC%E5%9D%AA%E9%83%BD%E6%9C%83%E5%85%AC%E5%9C%92","lat":25.0107,"lng":121.471,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (196,52,3,'18:00-19:30','晚餐',NULL,'ai','板橋車站商圈',NULL,4.1,'Buon Pasta 建議訂位，饗食天堂假日熱門務必預約',NULL,NULL,NULL,'[{"name":"板橋車站商圈","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E8%BB%8A%E7%AB%99%E5%95%86%E5%9C%88","lat":25.0143,"lng":121.4633,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (197,53,0,'10:00-12:00','板橋慈惠宮','板橋在地信仰中心，媽祖廟，建築雕刻精美的百年古廟','ai','板橋慈惠宮',NULL,4.4,'廟旁就是黃石市場，可順便逛傳統市場吃小吃','car','開車 約12分鐘',12,'[{"name":"板橋慈惠宮","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E6%85%88%E6%83%A0%E5%AE%AE","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E6%85%88%E6%83%A0%E5%AE%AE","lat":25.0111,"lng":121.46,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (198,53,1,'12:00-13:00','午餐',NULL,'ai','板橋府中商圈',NULL,4.1,'秋香ㄟ店週一公休且下午就收攤，建議早點去',NULL,NULL,NULL,'[{"name":"板橋府中商圈","googleQuery":"https://www.google.com/maps/search/%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%9D%BF%E6%A9%8B%E5%BA%9C%E4%B8%AD%E5%95%86%E5%9C%88","lat":25.0128,"lng":121.4636,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (199,53,2,'17:00-19:30','湳雅觀光夜市','板橋最大夜市，在地美食小吃聚集地，南雅東路上的傳統夜市','ai','湳雅觀光夜市',NULL,4,'每天營業，臭豆腐和藥燉排骨是必吃攤位','car','開車 約10分鐘',10,'[{"name":"湳雅觀光夜市","googleQuery":"https://www.google.com/maps/search/%E6%B9%B3%E9%9B%85%E8%A7%80%E5%85%89%E5%A4%9C%E5%B8%82","appleQuery":"https://maps.apple.com/?q=%E6%B9%B3%E9%9B%85%E8%A7%80%E5%85%89%E5%A4%9C%E5%B8%82","lat":25.0036,"lng":121.4642,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (200,54,0,'10:00-12:00','新月橋','橫跨大漢溪的人行景觀橋，連接板橋與新莊，夜間有LED光雕','ai','新月橋',NULL,4.4,'傍晚來看夕陽和LED光雕最美，橋上禁止騎自行車','car','開車 約15分鐘',15,'[{"name":"新月橋","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E6%9C%88%E6%A9%8B","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E6%9C%88%E6%A9%8B","lat":25.0319,"lng":121.4541,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (201,54,1,'12:00-13:00','午餐',NULL,'ai','新莊中正路商圈',NULL,4.1,'阿瑞官粿店下午就打烊，想吃古早味粿類建議中午前去',NULL,NULL,NULL,'[{"name":"新莊中正路商圈","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E4%B8%AD%E6%AD%A3%E8%B7%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E4%B8%AD%E6%AD%A3%E8%B7%AF%E5%95%86%E5%9C%88","lat":25.0358,"lng":121.4488,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (202,54,2,'14:00-16:30','大都會公園','二重疏洪道上的大型都會公園，遼闊草地、自行車道、棒壘球場','ai','新北大都會公園',NULL,4.6,'園區很大建議租自行車遊覽，有大型兒童遊戲場','car','開車 約10分鐘',10,'[{"name":"新北大都會公園","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E5%8C%97%E5%A4%A7%E9%83%BD%E6%9C%83%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E5%8C%97%E5%A4%A7%E9%83%BD%E6%9C%83%E5%85%AC%E5%9C%92","lat":25.0619,"lng":121.4668,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (203,54,3,'18:00-19:30','晚餐',NULL,'ai','新莊中正路商圈',NULL,4.1,'小義大利莊園建議訂位，三重鵝肉李現切鵝肉是招牌',NULL,NULL,NULL,'[{"name":"新莊中正路商圈","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E4%B8%AD%E6%AD%A3%E8%B7%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E4%B8%AD%E6%AD%A3%E8%B7%AF%E5%95%86%E5%9C%88","lat":25.0358,"lng":121.4488,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (204,55,0,'10:00-12:00','新莊體育場','新莊運動公園，棒球場、田徑場，職棒比賽舉辦場地','ai','新莊體育場',NULL,4.1,'若遇職棒賽事可現場購票入場，周邊停車較方便','car','開車 約20分鐘',20,'[{"name":"新莊體育場","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E9%AB%94%E8%82%B2%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E9%AB%94%E8%82%B2%E5%A0%B4","lat":25.0299,"lng":121.4533,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (205,55,1,'12:00-13:00','午餐',NULL,'ai','新莊廟街商圈',NULL,4,'熊越岳常排隊建議開門前到，福壽街陽春麵僅午餐時段',NULL,NULL,NULL,'[{"name":"新莊廟街商圈","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","lat":25.0353,"lng":121.445,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (206,55,2,'14:00-16:00','新莊廟街','新莊老街，慈祐宮、廣福宮等古廟群，傳統小吃與在地文化','ai','新莊廟街',NULL,4,'老順香鹹光餅是新莊名產必買，廟街老店集中好逛','car','開車 約10分鐘',10,'[{"name":"新莊廟街","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","lat":25.0353,"lng":121.445,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (207,55,3,'18:00-19:30','晚餐',NULL,'ai','新莊廟街商圈',NULL,4,'炊煙拉麵晚餐時段限定，Duke''s Pizza 不需訂位可直接入座',NULL,NULL,NULL,'[{"name":"新莊廟街商圈","googleQuery":"https://www.google.com/maps/search/%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%96%B0%E8%8E%8A%E5%BB%9F%E8%A1%97","lat":25.0353,"lng":121.445,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (208,56,0,'10:00-12:00','幸福水漾公園','三重大台北都會公園內，彩色地景藝術、大片花海、親子遊憩空間','ai','幸福水漾公園',NULL,4.2,'春季花海盛開時最漂亮，停車可停機捷三重站旁','car','開車 約20分鐘',20,'[{"name":"幸福水漾公園","googleQuery":"https://www.google.com/maps/search/%E4%B8%89%E9%87%8D%E5%B9%B8%E7%A6%8F%E6%B0%B4%E6%BC%BE%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E4%B8%89%E9%87%8D%E5%B9%B8%E7%A6%8F%E6%B0%B4%E6%BC%BE%E5%85%AC%E5%9C%92","lat":25.0619,"lng":121.4671,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (209,56,1,'12:00-13:00','午餐',NULL,'ai','三重正義北路商圈',NULL,4,'今大魯肉飯排隊名店建議避開尖峰，福F Pasta 巷弄內注意導航',NULL,NULL,NULL,'[{"name":"三重正義北路商圈","googleQuery":"https://www.google.com/maps/search/%E4%B8%89%E9%87%8D%E6%AD%A3%E7%BE%A9%E5%8C%97%E8%B7%AF","appleQuery":"https://maps.apple.com/?q=%E4%B8%89%E9%87%8D%E6%AD%A3%E7%BE%A9%E5%8C%97%E8%B7%AF","lat":25.0586,"lng":121.4857,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (210,56,2,'14:00-16:00','空軍三重一村','全台保存最完整的防砲眷村，已活化為文創園區，展覽與眷村生活體驗','ai','空軍三重一村',NULL,4.4,'免費參觀，週一休館，園區內有不少好拍的裝置藝術','car','開車 約10分鐘',10,'[{"name":"空軍三重一村","googleQuery":"https://www.google.com/maps/search/%E7%A9%BA%E8%BB%8D%E4%B8%89%E9%87%8D%E4%B8%80%E6%9D%91","appleQuery":"https://maps.apple.com/?q=%E7%A9%BA%E8%BB%8D%E4%B8%89%E9%87%8D%E4%B8%80%E6%9D%91","lat":25.0536,"lng":121.4895,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (211,56,3,'18:00-19:30','晚餐',NULL,'ai','三重正義北路商圈',NULL,4,'正羊肉榮建議訂位，冬天吃羊肉爐特別適合',NULL,NULL,NULL,'[{"name":"三重正義北路商圈","googleQuery":"https://www.google.com/maps/search/%E4%B8%89%E9%87%8D%E6%AD%A3%E7%BE%A9%E5%8C%97%E8%B7%AF","appleQuery":"https://maps.apple.com/?q=%E4%B8%89%E9%87%8D%E6%AD%A3%E7%BE%A9%E5%8C%97%E8%B7%AF","lat":25.0586,"lng":121.4857,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (212,57,0,'10:00-12:00','四號公園','永和最大公園，國立台灣圖書館所在地，綠蔭步道與兒童遊戲區','ai','四號公園',NULL,4.2,'國立台灣圖書館免費入館，公園內有松鼠出沒很療癒','car','開車 約15分鐘',15,'[{"name":"四號公園","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%92%8C%E5%9B%9B%E8%99%9F%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%92%8C%E5%9B%9B%E8%99%9F%E5%85%AC%E5%9C%92","lat":25.0108,"lng":121.5133,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (213,57,1,'12:00-13:00','午餐',NULL,'ai','永安市場商圈',NULL,4.1,'世界豆漿大王24小時營業隨時可去，藍乳酪建議訂位',NULL,NULL,NULL,'[{"name":"永安市場商圈","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4%E5%95%86%E5%9C%88","lat":25.0072,"lng":121.5099,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (214,57,2,'14:00-16:00','永安市場商圈','頂溪站周邊，永和豆漿、各式小吃，在地人的美食天堂','ai','永安市場',NULL,4.1,'永安市場周邊巷弄藏很多平價美食，可邊走邊吃','car','開車 約10分鐘',10,'[{"name":"永安市場","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4","lat":25.0072,"lng":121.5099,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (215,57,3,'18:00-19:30','晚餐',NULL,'ai','永安市場商圈',NULL,4.1,'Don''ts Don''ts Pasta 蛤蜊義大利麵份量驚人，竹林雞肉飯晚餐前會收',NULL,NULL,NULL,'[{"name":"永安市場商圈","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%AE%89%E5%B8%82%E5%A0%B4%E5%95%86%E5%9C%88","lat":25.0072,"lng":121.5099,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (216,58,0,'10:00-12:00','烘爐地','南山福德宮，中和知名土地公廟，山頂可俯瞰大台北夜景','ai','烘爐地南山福德宮',NULL,4.7,'山路階梯多建議穿好走的鞋，山頂夜景也很值得看','car','開車 約20分鐘',20,'[{"name":"烘爐地南山福德宮","googleQuery":"https://www.google.com/maps/search/%E7%83%98%E7%88%90%E5%9C%B0%E5%8D%97%E5%B1%B1%E7%A6%8F%E5%BE%B7%E5%AE%AE","appleQuery":"https://maps.apple.com/?q=%E7%83%98%E7%88%90%E5%9C%B0%E5%8D%97%E5%B1%B1%E7%A6%8F%E5%BE%B7%E5%AE%AE","lat":24.9884,"lng":121.5126,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (217,58,1,'12:00-13:00','午餐',NULL,'ai','中和環球購物中心',NULL,4,'中和連城路米粉湯僅早午餐時段營業，下午就收攤',NULL,NULL,NULL,'[{"name":"中和環球購物中心","googleQuery":"https://www.google.com/maps/search/%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","appleQuery":"https://maps.apple.com/?q=%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","lat":24.9987,"lng":121.5038,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (218,58,2,'14:00-16:00','中和環球購物中心','中和地標購物中心，美食街、電影院、各式品牌商店','ai','中和環球購物中心',NULL,4,'與中和捷運站共構，地下美食街選擇很多','car','開車 約15分鐘',15,'[{"name":"中和環球購物中心","googleQuery":"https://www.google.com/maps/search/%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","appleQuery":"https://maps.apple.com/?q=%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","lat":24.9987,"lng":121.5038,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (219,58,3,'18:00-19:30','晚餐',NULL,'ai','中和環球購物中心',NULL,4,'一幸拉麵分午晚兩時段注意營業時間，阿男麻辣鍋建議訂位',NULL,NULL,NULL,'[{"name":"中和環球購物中心","googleQuery":"https://www.google.com/maps/search/%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","appleQuery":"https://maps.apple.com/?q=%E4%B8%AD%E5%92%8C%E7%92%B0%E7%90%83%E8%B3%BC%E7%89%A9%E4%B8%AD%E5%BF%83","lat":24.9987,"lng":121.5038,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (220,59,0,'14:00-16:00','仁愛公園','永和大型公園，環狀步道、籃球場、兒童遊戲區，社區休閒好去處','ai','永和仁愛公園',NULL,4.1,'適合散步放鬆，公園旁有不少咖啡廳可休息','car','開車 約15分鐘',15,'[{"name":"永和仁愛公園","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%92%8C%E4%BB%81%E6%84%9B%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%92%8C%E4%BB%81%E6%84%9B%E5%85%AC%E5%9C%92","lat":25.0102,"lng":121.5159,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (221,59,1,'12:00-13:00','午餐',NULL,'ai','永和樂華商圈',NULL,4.1,'麵屋鴒分午晚兩時段中間休息，禾多靜巷建議訂位',NULL,NULL,NULL,'[{"name":"永和樂華商圈","googleQuery":"https://www.google.com/maps/search/%E6%B0%B8%E5%92%8C%E6%A8%82%E8%8F%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%B0%B8%E5%92%8C%E6%A8%82%E8%8F%AF%E5%95%86%E5%9C%88","lat":25.0071,"lng":121.509,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (222,59,2,'17:30-20:00','樂華夜市','永和最知名夜市，在地經營數十年，各式台灣小吃與服飾攤位','ai','樂華夜市',NULL,4.3,'每天營業，蕭家下港排骨酥湯和正彰化肉圓是人氣攤位','car','開車 約10分鐘',10,'[{"name":"樂華夜市","googleQuery":"https://www.google.com/maps/search/%E6%A8%82%E8%8F%AF%E5%A4%9C%E5%B8%82","appleQuery":"https://maps.apple.com/?q=%E6%A8%82%E8%8F%AF%E5%A4%9C%E5%B8%82","lat":25.0077,"lng":121.5084,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (223,60,0,'10:00-12:00','桐花公園','土城桐花公園，四月油桐花季賞花勝地，登山步道與觀景平台','ai','土城桐花公園',NULL,4.3,'四月正值桐花季，步道沿途落花如雪非常浪漫','car','開車 約20分鐘',20,'[{"name":"土城桐花公園","googleQuery":"https://www.google.com/maps/search/%E5%9C%9F%E5%9F%8E%E6%A1%90%E8%8A%B1%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E5%9C%9F%E5%9F%8E%E6%A1%90%E8%8A%B1%E5%85%AC%E5%9C%92","lat":24.9743,"lng":121.4484,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (224,60,1,'12:00-13:00','午餐',NULL,'ai','土城中央路商圈',NULL,4,'土城中央路米粉湯僅早午餐營業，想吃建議早點到',NULL,NULL,NULL,'[{"name":"土城中央路商圈","googleQuery":"https://www.google.com/maps/search/%E5%9C%9F%E5%9F%8E%E4%B8%AD%E5%A4%AE%E8%B7%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E5%9C%9F%E5%9F%8E%E4%B8%AD%E5%A4%AE%E8%B7%AF%E5%95%86%E5%9C%88","lat":24.9741,"lng":121.446,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (225,60,2,'14:00-16:00','承天禪寺','土城山區佛教寺院，環境清幽，登山步道沿途綠意盎然','ai','承天禪寺',NULL,4.7,'寺內環境莊嚴清幽，登山步道約30分鐘可到達','car','開車 約5分鐘',5,'[{"name":"承天禪寺","googleQuery":"https://www.google.com/maps/search/%E6%89%BF%E5%A4%A9%E7%A6%AA%E5%AF%BA","appleQuery":"https://maps.apple.com/?q=%E6%89%BF%E5%A4%A9%E7%A6%AA%E5%AF%BA","lat":24.9624,"lng":121.4503,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (226,60,3,'18:00-19:30','晚餐',NULL,'ai','土城中央路商圈',NULL,4,'一蘭拉麵營業到深夜不趕時間，土城鹽酥雞可外帶當宵夜',NULL,NULL,NULL,'[{"name":"土城中央路商圈","googleQuery":"https://www.google.com/maps/search/%E5%9C%9F%E5%9F%8E%E4%B8%AD%E5%A4%AE%E8%B7%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E5%9C%9F%E5%9F%8E%E4%B8%AD%E5%A4%AE%E8%B7%AF%E5%95%86%E5%9C%88","lat":24.9741,"lng":121.446,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (227,61,0,'10:00-12:00','大安圳步道','樹林沿水圳修築的休閒步道，平坦好走，沿途自然生態豐富','ai','大安圳步道',NULL,4.1,'全程平坦適合各年齡層，沿途有遮蔭不怕曬','car','開車 約20分鐘',20,'[{"name":"大安圳步道","googleQuery":"https://www.google.com/maps/search/%E6%A8%B9%E6%9E%97%E5%A4%A7%E5%AE%89%E5%9C%B3%E6%AD%A5%E9%81%93","appleQuery":"https://maps.apple.com/?q=%E6%A8%B9%E6%9E%97%E5%A4%A7%E5%AE%89%E5%9C%B3%E6%AD%A5%E9%81%93","lat":24.994,"lng":121.4233,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (228,61,1,'12:00-13:00','午餐',NULL,'ai','樹林中山路商圈',NULL,4,'Marcoo 手工義大利麵需預約且座位少，鬼匠拉麵CP值超高',NULL,NULL,NULL,'[{"name":"樹林中山路商圈","googleQuery":"https://www.google.com/maps/search/%E6%A8%B9%E6%9E%97%E4%B8%AD%E5%B1%B1%E8%B7%AF%E5%95%86%E5%9C%88","appleQuery":"https://maps.apple.com/?q=%E6%A8%B9%E6%9E%97%E4%B8%AD%E5%B1%B1%E8%B7%AF%E5%95%86%E5%9C%88","lat":24.9884,"lng":121.4205,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (229,61,2,'17:00-19:30','樹林興仁花園夜市','新北最大花園夜市，週三五六日營業，占地廣大的露天夜市','ai','樹林興仁花園夜市',NULL,4,'僅週三五六日營業，停車場寬敞免費','car','開車 約15分鐘',15,'[{"name":"樹林興仁花園夜市","googleQuery":"https://www.google.com/maps/search/%E6%A8%B9%E6%9E%97%E8%88%88%E4%BB%81%E8%8A%B1%E5%9C%92%E5%A4%9C%E5%B8%82","appleQuery":"https://maps.apple.com/?q=%E6%A8%B9%E6%9E%97%E8%88%88%E4%BB%81%E8%8A%B1%E5%9C%92%E5%A4%9C%E5%B8%82","lat":24.987,"lng":121.4131,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (230,62,0,'10:00-12:00','山佳車站','百年日式木造車站，市定古蹟，鐵道文化園區與彩繪牆','ai','山佳車站',NULL,4.2,'舊站體免費參觀，附近彩繪牆很適合拍照打卡','car','開車 約25分鐘',25,'[{"name":"山佳車站","googleQuery":"https://www.google.com/maps/search/%E5%B1%B1%E4%BD%B3%E8%BB%8A%E7%AB%99","appleQuery":"https://maps.apple.com/?q=%E5%B1%B1%E4%BD%B3%E8%BB%8A%E7%AB%99","lat":24.9788,"lng":121.3947,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (231,62,1,'12:00-13:00','午餐',NULL,'ai','樹林保安街商圈',NULL,4,'上津日式拉麵每日限量30碗建議早去，山佳切仔麵下午收攤',NULL,NULL,NULL,'[{"name":"樹林保安街商圈","googleQuery":"https://www.google.com/maps/search/%E6%A8%B9%E6%9E%97%E4%BF%9D%E5%AE%89%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%A8%B9%E6%9E%97%E4%BF%9D%E5%AE%89%E8%A1%97","lat":24.9844,"lng":121.4216,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (232,62,2,'14:00-16:00','鹿角溪人工濕地','樹林環保生態濕地，水鳥棲息地，適合賞鳥與自然觀察','ai','鹿角溪人工濕地',NULL,4.2,'帶望遠鏡可賞鳥，步道平緩適合悠閒散步','car','開車 約15分鐘',15,'[{"name":"鹿角溪人工濕地","googleQuery":"https://www.google.com/maps/search/%E9%B9%BF%E8%A7%92%E6%BA%AA%E4%BA%BA%E5%B7%A5%E6%BF%95%E5%9C%B0","appleQuery":"https://maps.apple.com/?q=%E9%B9%BF%E8%A7%92%E6%BA%AA%E4%BA%BA%E5%B7%A5%E6%BF%95%E5%9C%B0","lat":24.9952,"lng":121.4086,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (233,62,3,'18:00-19:30','晚餐',NULL,'ai','樹林保安街商圈',NULL,4,'桐生拉麵晚餐時段17:30才開，保安街夜市小吃選擇多',NULL,NULL,NULL,'[{"name":"樹林保安街商圈","googleQuery":"https://www.google.com/maps/search/%E6%A8%B9%E6%9E%97%E4%BF%9D%E5%AE%89%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%A8%B9%E6%9E%97%E4%BF%9D%E5%AE%89%E8%A1%97","lat":24.9844,"lng":121.4216,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (234,63,0,'10:00-12:00','淡水老街','新北最知名老街，阿給、魚丸、鐵蛋，沿河岸散步看觀音山','ai','淡水老街',NULL,4.2,'假日人潮較多建議平日前往，河岸步道傍晚看夕陽最美','car','開車 約40分鐘',40,'[{"name":"淡水老街","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","lat":25.1712,"lng":121.4426,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (235,63,1,'12:00-13:00','午餐',NULL,'ai','淡水老街',NULL,4.2,'文化阿給下午就打烊，滬尾義式廚房建議訂位享河景座位',NULL,NULL,NULL,'[{"name":"淡水老街","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","lat":25.1712,"lng":121.4426,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (236,63,2,'14:00-16:00','紅毛城','國定古蹟，荷蘭人始建的城堡，見證淡水四百年歷史','ai','紅毛城',NULL,4.3,'門票80元可同時參觀小白宮與滬尾砲台，週一休館','car','開車 約5分鐘',5,'[{"name":"紅毛城","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E7%B4%85%E6%AF%9B%E5%9F%8E","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E7%B4%85%E6%AF%9B%E5%9F%8E","lat":25.1757,"lng":121.4344,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (237,63,3,'18:00-19:30','晚餐',NULL,'ai','淡水老街',NULL,4.2,'二月拉麵可免費加麵且客製化程度高，之間茶食器建議訂位',NULL,NULL,NULL,'[{"name":"淡水老街","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E8%80%81%E8%A1%97","lat":25.1712,"lng":121.4426,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (238,64,0,'10:00-12:00','漁人碼頭','淡水漁人碼頭，情人橋、木棧道，欣賞淡水河出海口與夕陽','ai','淡水漁人碼頭',NULL,4.4,'情人橋傍晚點燈很浪漫，碼頭有付費停車場','car','開車 約40分鐘',40,'[{"name":"淡水漁人碼頭","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","lat":25.1852,"lng":121.415,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (239,64,1,'12:00-13:00','午餐',NULL,'ai','淡水漁人碼頭',NULL,4.2,'麵屋敬太中午才開且分兩時段，安乘建議訂位享碼頭景觀',NULL,NULL,NULL,'[{"name":"淡水漁人碼頭","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","lat":25.1852,"lng":121.415,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (240,64,2,'14:00-16:00','淡水海關碼頭','清代海關遺址，洋樓建築與倉庫群，河畔藝文展覽空間','ai','淡水海關碼頭',NULL,4.4,'免費參觀，倉庫群常有特展，河畔草地可野餐','car','開車 約10分鐘',10,'[{"name":"淡水海關碼頭","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E6%B5%B7%E9%97%9C%E7%A2%BC%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E6%B5%B7%E9%97%9C%E7%A2%BC%E9%A0%AD","lat":25.1698,"lng":121.44,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (241,64,3,'18:00-19:30','晚餐',NULL,'ai','淡水漁人碼頭',NULL,4.2,'鷄道樂排隊名店建議提早到，八里水岸建議訂位賞夕陽',NULL,NULL,NULL,'[{"name":"淡水漁人碼頭","googleQuery":"https://www.google.com/maps/search/%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E6%B7%A1%E6%B0%B4%E6%BC%81%E4%BA%BA%E7%A2%BC%E9%A0%AD","lat":25.1852,"lng":121.415,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (242,65,0,'10:00-12:00','八里左岸','八里渡船頭對岸，自行車道沿河岸延伸，河畔咖啡與小吃','ai','八里左岸',NULL,4.2,'可租自行車沿河岸騎到十三行博物館，沿途風景優美','car','開車 約45分鐘',45,'[{"name":"八里左岸","googleQuery":"https://www.google.com/maps/search/%E5%85%AB%E9%87%8C%E5%B7%A6%E5%B2%B8","appleQuery":"https://maps.apple.com/?q=%E5%85%AB%E9%87%8C%E5%B7%A6%E5%B2%B8","lat":25.1571,"lng":121.3983,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (243,65,1,'12:00-13:00','午餐',NULL,'ai','八里渡船頭',NULL,4.2,'兔宅子僅16席需預約，八里雙胞胎現炸趁熱吃最好',NULL,NULL,NULL,'[{"name":"八里渡船頭","googleQuery":"https://www.google.com/maps/search/%E5%85%AB%E9%87%8C%E6%B8%A1%E8%88%B9%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E5%85%AB%E9%87%8C%E6%B8%A1%E8%88%B9%E9%A0%AD","lat":25.1571,"lng":121.3984,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (244,65,2,'14:00-16:00','十三行博物館','北台灣考古博物館，十三行遺址出土文物，互動式展覽與八里在地歷史','ai','十三行博物館',NULL,4.4,'門票80元，週一休館，頂樓觀景台可眺望淡水河出海口','car','開車 約5分鐘',5,'[{"name":"十三行博物館","googleQuery":"https://www.google.com/maps/search/%E5%8D%81%E4%B8%89%E8%A1%8C%E5%8D%9A%E7%89%A9%E9%A4%A8","appleQuery":"https://maps.apple.com/?q=%E5%8D%81%E4%B8%89%E8%A1%8C%E5%8D%9A%E7%89%A9%E9%A4%A8","lat":25.1545,"lng":121.3914,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (245,65,3,'18:00-19:30','晚餐',NULL,'ai','八里渡船頭',NULL,4.2,'提立歐建議訂位享河岸景觀，佘家孔雀蛤是八里必吃名產',NULL,NULL,NULL,'[{"name":"八里渡船頭","googleQuery":"https://www.google.com/maps/search/%E5%85%AB%E9%87%8C%E6%B8%A1%E8%88%B9%E9%A0%AD","appleQuery":"https://maps.apple.com/?q=%E5%85%AB%E9%87%8C%E6%B8%A1%E8%88%B9%E9%A0%AD","lat":25.1571,"lng":121.3984,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (246,66,0,'06:05','抵達金海機場','入境、領取行李、購買 T-money 卡','ai','test',NULL,4.1,NULL,'train','搭地鐵輕軌轉乘至 Centum City 約 50 分鐘',50,'[{"name":"金海國際機場","googleQuery":"https://www.google.com/maps/search/%EA%B9%80%ED%95%B4%EA%B5%AD%EC%A0%9C%EA%B3%B5%ED%95%AD","appleQuery":"https://maps.apple.com/?q=%EA%B9%80%ED%95%B4%EA%B5%AD%EC%A0%9C%EA%B3%B5%ED%95%AD","naverQuery":"https://map.naver.com/v5/search/%E9%87%91%E6%B5%B7%E5%9B%BD%E9%99%85%E6%9C%BA%E5%9C%BA","lat":35.1796,"lng":128.9381,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (247,66,1,'08:00','SPA LAND 汗蒸幕','新世界 Centum City 百貨 B1，韓式汗蒸幕體驗、各種主題溫泉池','ai','스파랜드 센텀시티',NULL,4.5,'建議一早開門就入場人較少，可帶泳衣使用露天池，館內提供毛巾和汗蒸服','walk','步行約 15 分鐘',15,'[{"name":"스파랜드 센텀시티","googleQuery":"https://www.google.com/maps/search/%EC%8A%A4%ED%8C%8C%EB%9E%9C%EB%93%9C+%EC%84%BC%ED%85%80%EC%8B%9C%ED%8B%B0+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%8A%A4%ED%8C%8C%EB%9E%9C%EB%93%9C+%EC%84%BC%ED%85%80%EC%8B%9C%ED%8B%B0+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%8A%A4%ED%8C%8C%EB%9E%9C%EB%93%9C+%EC%84%BC%ED%85%80%EC%8B%9C%ED%8B%B0","lat":35.169,"lng":129.131,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (248,66,2,'10:30','溫泉川公園','釜山知名賞櫻景點，溫泉川沿岸櫻花步道','ai','온천천 시민공원',NULL,4.5,'三月下旬正值櫻花季，沿溫泉川步道散步約需 30 分鐘','train','搭地鐵至西面站約 10 分鐘',10,'[{"name":"온천천 시민공원","googleQuery":"https://www.google.com/maps/search/%EC%98%A8%EC%B2%9C%EC%B2%9C+%EC%8B%9C%EB%AF%BC%EA%B3%B5%EC%9B%90+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%98%A8%EC%B2%9C%EC%B2%9C+%EC%8B%9C%EB%AF%BC%EA%B3%B5%EC%9B%90+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%98%A8%EC%B2%9C%EC%B2%9C+%EC%8B%9C%EB%AF%BC%EA%B3%B5%EC%9B%90","lat":35.1917,"lng":129.0617,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (249,66,3,'12:00','午餐（西面）','西面商圈用餐','ai','西面商圈',NULL,4,'西面站 1 號出口出來即是美食街，平日午餐不太需要排隊','walk','步行約 10 分鐘',10,'[{"name":"西面商圈","googleQuery":"https://www.google.com/maps/search/%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%E8%A5%BF%E9%9D%A2%E5%95%86%E5%9C%88","lat":35.1579,"lng":129.059,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (250,66,4,'13:30','釜田市場','釜山最大傳統市場，體驗在地市場文化','ai','부전시장',NULL,4.2,'市場內多數攤位僅收現金，建議先準備好韓元零鈔','walk','步行約 10 分鐘',10,'[{"name":"부전시장","googleQuery":"https://www.google.com/maps/search/%EB%B6%80%EC%A0%84%EC%8B%9C%EC%9E%A5+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EB%B6%80%EC%A0%84%EC%8B%9C%EC%9E%A5+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EB%B6%80%EC%A0%84%EC%8B%9C%EC%9E%A5","lat":35.1601,"lng":129.0574,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (251,66,5,'15:00','西面逛街','西面地下街、田浦咖啡街散步購物','ai','서면 지하상가',NULL,4.1,'地下街價格平實適合挖寶，田浦咖啡街則有許多文青風格小店','walk','步行約 5 分鐘',5,'[{"name":"서면 지하상가","googleQuery":"https://www.google.com/maps/search/%EC%84%9C%EB%A9%B4+%EC%A7%80%ED%95%98%EC%83%81%EA%B0%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%84%9C%EB%A9%B4+%EC%A7%80%ED%95%98%EC%83%81%EA%B0%80+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%84%9C%EB%A9%B4+%EC%A7%80%ED%95%98%EC%83%81%EA%B0%80","lat":35.1579,"lng":129.059,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (252,66,6,'16:30','Hytte Roastery','西面人氣精品咖啡廳，自家烘焙豆、北歐風空間','ai','휘테 로스터리',NULL,4.7,'座位不多，假日下午常客滿，建議平日前往或外帶','walk','步行約 10 分鐘',10,'[{"name":"휘테 로스터리","googleQuery":"https://www.google.com/maps/search/%ED%9C%98%ED%85%8C%EB%A1%9C%EC%8A%A4%ED%84%B0%EB%A6%AC+%EC%84%9C%EB%A9%B4+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%ED%9C%98%ED%85%8C%EB%A1%9C%EC%8A%A4%ED%84%B0%EB%A6%AC+%EC%84%9C%EB%A9%B4+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%ED%9C%98%ED%85%8C+%EB%A1%9C%EC%8A%A4%ED%84%B0%EB%A6%AC","lat":35.1589,"lng":129.0567,"geocode_status":"review"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (253,66,7,'18:30','晚餐（西面）','西面商圈晚餐','ai','西面商圈',NULL,4,'週五晚間西面商圈人潮最多，熱門餐廳建議提前訂位','walk','步行約 5 分鐘',5,'[{"name":"西面商圈","googleQuery":"https://www.google.com/maps/search/%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%00%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%E8%A5%BF%E9%9D%A2%E5%95%86%E5%9C%88","lat":35.1579,"lng":129.059,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (254,66,8,'20:00','樂天百貨 西面店','西面地標百貨，免稅購物、伴手禮採買','ai','롯데백화점 서면점',NULL,4.2,'持外國護照可至服務台領取折扣券，B1 超市適合買伴手禮','train','搭地鐵 1 號線至南浦站約 15 分鐘',15,'[{"name":"롯데백화점 서면점","googleQuery":"https://www.google.com/maps/search/%EB%A1%AF%EB%8D%B0%EB%B0%B1%ED%99%94%EC%A0%90+%EC%84%9C%EB%A9%B4%EC%A0%90+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EB%A1%AF%EB%8D%B0%EB%B0%B1%ED%99%94%EC%A0%90+%EC%84%9C%EB%A9%B4%EC%A0%90+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EB%A1%AF%EB%8D%B0%EB%B0%B1%ED%99%94%EC%A0%90+%EC%84%9C%EB%A9%B4%EC%A0%90","lat":35.1593,"lng":129.0603,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (255,67,0,'10:00','午餐（西面）','早午餐，品嚐釜山在地豬肉湯飯','ai','西面商圈',NULL,4.3,'豬肉湯飯是釜山必吃早餐，湯頭濃郁可免費續飯','train','搭地鐵 1 號線至土城站再轉公車約 30 分鐘',30,'[{"name":"西面商圈","googleQuery":"https://www.google.com/maps/search/%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%84%9C%EB%A9%B4%EC%97%AD+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%E8%A5%BF%E9%9D%A2%E5%95%86%E5%9C%88","lat":35.1579,"lng":129.059,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (256,67,1,'11:30','甘川洞文化村','色彩繽紛的壁畫村，「韓國的聖乎里尼」，拍照打卡聖地','ai','감천문화마을',NULL,4.4,'入口處可購買集章地圖，坡道階梯多建議穿好走的鞋','bus','搭公車轉地鐵至松島約 30 分鐘',30,'[{"name":"감천문화마을","googleQuery":"https://www.google.com/maps/search/%EA%B0%90%EC%B2%9C%EB%AC%B8%ED%99%94%EB%A7%88%EC%9D%84+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EA%B0%90%EC%B2%9C%EB%AC%B8%ED%99%94%EB%A7%88%EC%9D%84+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EA%B0%90%EC%B2%9C%EB%AC%B8%ED%99%94%EB%A7%88%EC%9D%84","lat":35.0975,"lng":129.0104,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (257,67,2,'14:00','松島海上纜車','松島天空步道＋海上纜車，飽覽南港灣海景','ai','송도해상케이블카',NULL,4.3,'推薦搭水晶車廂（透明地板），週末排隊可能超過 30 分鐘建議先線上購票','bus','搭公車至南浦洞約 20 分鐘',20,'[{"name":"송도해상케이블카","googleQuery":"https://www.google.com/maps/search/%EC%86%A1%EB%8F%84%ED%95%B4%EC%83%81%EC%BC%80%EC%9D%B4%EB%B8%94%EC%B9%B4+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%86%A1%EB%8F%84%ED%95%B4%EC%83%81%EC%BC%80%EC%9D%B4%EB%B8%94%EC%B9%B4+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%86%A1%EB%8F%84%ED%95%B4%EC%83%81%EC%BC%80%EC%9D%B4%EB%B8%94%EC%B9%B4","lat":35.0694,"lng":129.0175,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (258,67,3,'16:00','國際市場','釜山最大傳統市場，小吃、服飾、日用品一應俱全','ai','국제시장',NULL,4.2,'必吃糖餅和魚板，可順路走到隔壁 BIFF 廣場吃街頭小吃','walk','步行約 10 分鐘',10,'[{"name":"국제시장","googleQuery":"https://www.google.com/maps/search/%EA%B5%AD%EC%A0%9C%EC%8B%9C%EC%9E%A5+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EA%B5%AD%EC%A0%9C%EC%8B%9C%EC%9E%A5+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EA%B5%AD%EC%A0%9C%EC%8B%9C%EC%9E%A5","lat":35.0989,"lng":129.0268,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (259,67,4,'18:30','晚餐（南浦洞）','南浦洞商圈晚餐','ai','南浦洞商圈',NULL,4.3,'南浦洞晚間很熱鬧，飯後可沿光復路散步消食','walk','步行回飯店約 10 分鐘',10,'[{"name":"南浦洞商圈","googleQuery":"https://www.google.com/maps/search/%EB%82%A8%ED%8F%AC%EB%8F%99+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EB%82%A8%ED%8F%AC%EB%8F%99+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%E5%8D%97%E6%B5%A6%E6%B4%9E%E5%95%86%E5%9C%88","lat":35.0977,"lng":129.027,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (260,68,0,'09:00','Egg Drop 早餐','韓國人氣早餐三明治連鎖，厚蛋吐司必點','ai','에그드랍 서면점',NULL,4.4,'推薦培根起司蛋吐司，早上人潮多建議外帶','train','搭地鐵至 Centum City 站轉公車至機張約 50 分鐘',50,'[{"name":"에그드랍 서면점","googleQuery":"https://www.google.com/maps/search/%EC%97%90%EA%B7%B8%EB%93%9C%EB%9E%8D+%EC%84%9C%EB%A9%B4+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%97%90%EA%B7%B8%EB%93%9C%EB%9E%8D+%EC%84%9C%EB%A9%B4+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%97%90%EA%B7%B8%EB%93%9C%EB%9E%8D+%EC%84%9C%EB%A9%B4%EC%A0%90","lat":35.1579,"lng":129.059,"geocode_status":"review"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (261,68,1,'10:30','ARTE Museum 釜山','沉浸式數位藝術展覽，多個主題展廳、光影互動體驗','ai','아르떼뮤지엄 부산',NULL,4.9,'建議線上預購門票較便宜，穿深色衣服拍照效果最好','bus','搭公車約 15 分鐘',15,'[{"name":"아르떼뮤지엄 부산","googleQuery":"https://www.google.com/maps/search/%EC%95%84%EB%A5%B4%EB%96%BC%EB%AE%A4%EC%A7%80%EC%97%84+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%95%84%EB%A5%B4%EB%96%BC%EB%AE%A4%EC%A7%80%EC%97%84+%EB%B6%00%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%95%84%EB%A5%B4%EB%96%BC%EB%AE%A4%EC%A7%80%EC%97%84+%EB%B6%80%EC%82%B0","lat":35.1771,"lng":129.1917,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (262,68,2,'12:30','午餐（機張海女村）','機張海女村品嚐新鮮海產','ai','기장 해녀촌',NULL,4,'海女村海鮮可現選現煮，價格可議價，建議多人合點一桌海鮮拼盤','bus','搭公車轉地鐵至廣安里約 60 分鐘',60,'[{"name":"기장 해녀촌","googleQuery":"https://www.google.com/maps/search/%EA%B8%B0%EC%9E%A5+%ED%95%B4%EB%85%80%EC%B4%8C+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EA%B8%B0%EC%9E%A5+%ED%95%B4%EB%85%80%EC%B4%8C+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EA%B8%B0%EC%9E%A5+%ED%95%B4%EB%85%80%EC%B4%8C","lat":35.2449,"lng":129.2194,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (263,68,3,'18:00','晚餐（廣安里）','廣安里海灘周邊晚餐','ai','광안리 해변',NULL,4.5,'海灘沿線有很多景觀餐廳，靠窗座位可邊用餐邊看廣安大橋','walk','步行約 5 分鐘至海灘',5,'[{"name":"광안리 해변","googleQuery":"https://www.google.com/maps/search/%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EB%B3%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EB%B3%80+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EA%B4%91%EC%95%88%EB%A6%AC+%ED%95%B4%EB%B3%80","lat":35.1533,"lng":129.1186,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (264,68,4,'19:30','廣安里海灘夜景','欣賞廣安大橋夜間燈光秀，海灘散步','ai','광안리해변',NULL,4.5,'廣安大橋每晚點燈，週末有燈光秀表演，海灘旁便利商店可買飲料坐著欣賞','train','搭地鐵 2 號線至南浦站約 25 分鐘',25,'[{"name":"광안리해변","googleQuery":"https://www.google.com/maps/search/%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EB%B3%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EB%B3%80+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EB%B3%80","lat":35.1533,"lng":129.1186,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (265,69,0,'09:30','Skyline Luge 釜山','海雲台空中纜車＋斜坡滑車，刺激好玩又能眺望海景','ai','스카이라인루지 부산',NULL,4.5,'建議買三次以上套票較划算，開門時段去幾乎不用排隊','walk','步行約 15 分鐘至海理團路',15,'[{"name":"스카이라인루지 부산","googleQuery":"https://www.google.com/maps/search/%EC%8A%A4%EC%B9%B4%EC%9D%B4%EB%9D%BC%EC%9D%B8%EB%A3%A8%EC%A7%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%8A%A4%EC%B9%B4%EC%9D%B4%EB%9D%BC%EC%9D%B8%EB%A3%A8%EC%A7%80+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%8A%A4%EC%B9%B4%EC%9D%B4%EB%9D%BC%EC%9D%B8%EB%A3%A8%EC%A7%80+%EB%B6%80%EC%82%B0","lat":35.1569,"lng":129.1631,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (266,69,1,'11:30','海理團路','海雲台文青散步街區，特色小店與咖啡廳林立','ai','해리단길',NULL,4.3,'巷弄裡隱藏很多特色咖啡廳和選物店，適合慢慢逛拍照','walk','步行約 5 分鐘',5,'[{"name":"해리단길","googleQuery":"https://www.google.com/maps/search/%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8+%ED%95%B4%EC%9A%B4%EB%8C%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8+%ED%95%B4%EC%9A%B4%EB%8C%80+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8","lat":35.1582,"lng":129.1585,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (267,69,2,'12:30','午餐（海雲台）','海雲台周邊午餐','ai','해운대 해리단길',NULL,4,'海雲台站周邊餐廳密集，海理團路上也有不少選擇','walk','步行至海雲台海邊列車站約 10 分鐘',10,'[{"name":"해운대 해리단길","googleQuery":"https://www.google.com/maps/search/%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8+%ED%95%B4%EC%9A%B4%EB%8C%80+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8+%ED%95%B4%EC%9A%B4%EB%8C%80+%EB%B6%00%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%ED%95%B4%EC%9A%B4%EB%8C%80+%ED%95%B4%EB%A6%AC%EB%8B%A8%EA%B8%B8","lat":35.1582,"lng":129.1585,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (268,69,3,'14:30','Blue Line Park 膠囊列車','海雲台至青沙埔海岸膠囊列車，沿海絕美景觀','ai','블루라인파크 해변열차',NULL,4.4,'強烈建議線上預約指定時段，現場常售罄，海邊列車和膠囊列車是不同票','train','膠囊列車至青沙埔站約 15 分鐘',15,'[{"name":"블루라인파크 해변열차","googleQuery":"https://www.google.com/maps/search/%EB%B8%94%EB%A3%A8%EB%9D%BC%EC%9D%B8%ED%8C%8C%ED%81%AC+%ED%95%B4%EB%B3%80%EC%97%B4%EC%B0%A8+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EB%B8%94%EB%A3%A8%EB%9D%BC%EC%9D%B8%ED%8C%8C%ED%81%AC+%ED%95%B4%EB%B3%80%EC%97%B4%EC%B0%A8+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EB%B8%94%EB%A3%A8%EB%9D%BC%EC%9D%B8%ED%8C%8C%ED%81%AC+%ED%95%B4%EB%B3%80%EC%97%B4%EC%B0%A8","lat":35.174,"lng":129.2003,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (269,69,4,'15:30','青沙埔','海邊小漁村，天空步道、燈塔、海景咖啡廳','ai','청사포',NULL,4.5,'紅白燈塔是必拍景點，天空步道玻璃地板可俯瞰海面','train','搭地鐵至海雲台約 20 分鐘',20,'[{"name":"청사포","googleQuery":"https://www.google.com/maps/search/%EC%B2%AD%EC%82%AC%ED%8F%AC+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%EC%B2%AD%EC%82%AC%ED%8F%AC+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%EC%B2%AD%EC%82%AC%ED%8F%AC","lat":35.1795,"lng":129.2098,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (270,69,5,'18:00','晚餐（海雲台）','海雲台周邊晚餐','ai','해운대',NULL,4,'海雲台市場周邊有很多平價在地小吃店，氣氛比觀光區更道地','train','搭地鐵至西面轉乘約 30 分鐘',30,'[{"name":"해운대","googleQuery":"https://www.google.com/maps/search/%ED%95%B4%EC%9A%B4%EB%8C%80%EC%97%AD+%EB%B6%80%EC%82%B0","appleQuery":"https://maps.apple.com/?q=%ED%95%B4%EC%9A%B4%EB%8C%80%EC%97%AD+%EB%B6%80%EC%82%B0","naverQuery":"https://map.naver.com/v5/search/%ED%95%B4%EC%9A%B4%EB%8C%80","lat":35.1587,"lng":129.1604,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (271,69,6,'19:30','超市採購','採買韓國零食、泡麵、伴手禮','ai','이마트 부산역점',NULL,4,'結帳時出示護照可退稅，建議帶大購物袋方便裝伴手禮','train','搭地鐵至南浦站約 15 分鐘',15,'[{"name":"이마트 부산역점","googleQuery":"https://www.google.com/maps/search/%EC%9D%B4%EB%A7%88%ED%8A%B8+%EB%B6%80%EC%82%B0%EC%97%AD%EC%A0%90","appleQuery":"https://maps.apple.com/?q=%EC%9D%B4%EB%A7%88%ED%8A%B8+%EB%B6%80%EC%82%B0%EC%97%AD%EC%A0%90","naverQuery":"https://map.naver.com/v5/search/%EC%9D%B4%EB%A7%88%ED%8A%B8+%EB%B6%80%EC%82%B0%EC%97%AD%EC%A0%90","lat":35.1128,"lng":129.0411,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (272,70,0,'09:00','扎嘎其市場','韓國最大海鮮市場，體驗活跳海產、現點現做','ai','자갈치시장',NULL,4.1,'一樓選海鮮二樓代煮，價格先談好再點，早上最新鮮','walk','步行約 10 分鐘',10,'[{"name":"자갈치시장","lat":35.0968,"lng":129.0302,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (273,70,1,'10:30','南浦洞逛街','BIFF 廣場、光復路購物街，最後採買','ai','BIFF광장 남포동',NULL,4.3,'BIFF 廣場的糖餅和烤魷魚是必吃街頭小吃','walk','步行約 5 分鐘',5,'[{"name":"BIFF광장 남포동","lat":35.099,"lng":129.0268,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (274,70,2,'12:30','午餐（南浦洞）','南浦洞午餐','ai','남포동',NULL,4,'南浦洞巷弄裡有很多隱藏版在地美食，不一定要選觀光區大店','walk','步行約 10 分鐘',10,'[{"name":"남포동","lat":35.0977,"lng":129.027,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (275,70,3,'14:00','光復路購物街','南浦洞主要購物街，最後採買伴手禮','ai','광복로 쇼핑거리',NULL,4.2,'Olive Young 和各大藥妝店集中在此，最後補貨的好地方','walk','步行約 5 分鐘',5,'[{"name":"광복로 쇼핑거리","lat":35.1008,"lng":129.028,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (276,70,4,'17:00','晚餐（南浦洞）','前往機場前的最後一餐','ai','남포동',NULL,4,'趕飛機建議選出餐快的餐廳，避免燒肉等候時間較長的類型','train','搭地鐵至沙上站轉輕軌至金海機場約 50 分鐘',50,'[{"name":"남포동","lat":35.0977,"lng":129.027,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (277,70,5,'19:30','前往金海機場','提前 2 小時抵達辦理登機手續','ai',NULL,NULL,NULL,NULL,'train','搭地鐵至沙上站轉輕軌至金海機場約 50 分鐘',50,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (278,70,6,'21:50','搭機返台','真航空 LJ751｜PUS 21:50 → TPE 23:40','ai',NULL,NULL,NULL,NULL,'plane','飛行約 2 小時 50 分鐘',NULL,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (279,71,0,'11:35','抵達關西機場','CI156 桃園→關西 08:05-11:35','ai','關西國際機場',NULL,4,'入境後到2F購買 ICOCA 或兌換 JR Pass，行李寄放可用機場置物櫃',NULL,NULL,NULL,'[{"name":"關西國際機場","googleQuery":"https://www.google.com/maps/search/Kansai+International+Airport","appleQuery":"https://maps.apple.com/?q=Kansai+International+Airport"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (280,71,1,'12:00-13:15','搭乘 Haruka 前往京都','WEST QR 搭乘，約75分鐘直達京都車站','ai',NULL,NULL,NULL,NULL,'train','Haruka 特急，約75分鐘',75,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (281,71,2,'13:15-14:00','午餐（京都車站周邊）','抵達京都車站後先吃午餐再前往飯店','ai','京都車站',NULL,4.1,'拉麵小路在10F平日也要排隊，建議先看哪家人少再決定',NULL,NULL,NULL,'[{"name":"京都車站","googleQuery":"https://www.google.com/maps/search/%E4%BA%AC%E9%83%BD%E9%A7%85","appleQuery":"https://maps.apple.com/?q=%E4%BA%AC%E9%83%BD%E9%A7%85"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (282,71,3,'14:00-14:30','Check-in Hotel Resol Trinity Kyoto','放行李後輕裝出發','ai','Hotel Resol Trinity Kyoto',NULL,4.3,NULL,'train','地下鐵烏丸線 京都→烏丸御池，約5分鐘',5,'[{"name":"Hotel Resol Trinity Kyoto","googleQuery":"https://www.google.com/maps/search/Hotel+Resol+Trinity+Kyoto","appleQuery":"https://maps.apple.com/?q=Hotel+Resol+Trinity+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (283,71,4,'14:30-15:30','La Madrague','昭和風喫茶店，招牌玉子三明治','ai','La Madrague',NULL,4.1,'玉子三明治限量供應，建議早點去以免售完','walking','步行約10分鐘',10,'[{"name":"La Madrague","googleQuery":"https://www.google.com/maps/search/La+Madrague+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=La+Madrague+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (284,71,5,'15:30-16:15','御金神社','金色鳥居的金運神社，祈求財運','ai','御金神社',NULL,4.3,'銀杏葉形繪馬很有特色，境內不大約15分鐘可逛完','walking','步行約8分鐘',8,'[{"name":"御金神社","googleQuery":"https://www.google.com/maps/search/%E5%BE%A1%E9%87%91%E7%A5%9E%E7%A4%BE+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E5%BE%A1%E9%87%91%E7%A5%9E%E7%A4%BE"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (285,71,6,'16:15-17:00','The House of Ki No Bi','京都琴酒蒸餾所 tasting room','ai','The House of Ki No Bi',NULL,4.4,'可預約 tasting flight 品飲體驗，京都在地植物風味琴酒值得一試','walking','步行約5分鐘',5,'[{"name":"The House of Ki No Bi","googleQuery":"https://www.google.com/maps/search/House+of+Ki+No+Bi+Kyoto","appleQuery":"https://maps.apple.com/?q=House+of+Ki+No+Bi+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (286,71,7,'17:00-20:00','河原町逛街','ARTS&SCIENCE KYOTO → Loft → Uniqlo → BAL → 百貨超市買草莓','user','河原町',NULL,4.2,'百貨超市約19:00後開始貼折扣標籤，草莓打折時很划算','walking','步行約10分鐘',10,'[{"name":"河原町","googleQuery":"https://www.google.com/maps/search/%E6%B2%B3%E5%8E%9F%E7%94%BA%E9%80%9A+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=Kawaramachi+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (287,71,8,'20:00-21:30','晚餐 柚子元','已預約 20:00，柚子料理專門店','ai','柚子元',NULL,4,'柚子鍋是招牌必點，店面小建議準時到','walking','步行約5分鐘',5,'[{"name":"柚子元","googleQuery":"https://www.google.com/maps/search/%E6%9F%9A%E5%AD%90%E5%85%83+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E6%9F%9A%E5%AD%90%E5%85%83+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (288,71,9,'21:30-22:00','扭蛋 C-pla','河原町扭蛋專門店','ai','C-pla',NULL,4.1,'機台數量多且種類齊全，可用現金或 IC 卡投幣','walking','步行約5分鐘',5,'[{"name":"C-pla","googleQuery":"https://www.google.com/maps/search/C-pla+%E4%BA%AC%E9%83%BD+%E6%B2%B3%E5%8E%9F%E7%94%BA","appleQuery":"https://maps.apple.com/?q=C-pla+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (289,72,0,'09:00-10:00','Stumptown Coffee Roasters','Portland 發跡的精品咖啡京都分店','ai','Stumptown Coffee Roasters',NULL,4.5,'町家改建空間很有氛圍，假日早上人潮多建議早到',NULL,NULL,NULL,'[{"name":"Stumptown Coffee Roasters","googleQuery":"https://www.google.com/maps/search/Stumptown+Coffee+Roasters+Kyoto","appleQuery":"https://maps.apple.com/?q=Stumptown+Coffee+Roasters+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (290,72,1,'10:00-11:00','前往宇治',NULL,'ai',NULL,NULL,NULL,NULL,'train','JR 奈良線 京都→宇治，約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (291,72,2,'11:00-12:00','午餐 MENYA INOICHI #3','宇治人氣拉麵，11:00 開店建議提早排隊','ai','MENYA INOICHI',NULL,4.3,'開店前15分鐘到排隊通常可趕上第一輪入座',NULL,NULL,NULL,'[{"name":"MENYA INOICHI","googleQuery":"https://www.google.com/maps/search/MENYA+INOICHI+%E5%AE%87%E6%B2%BB","appleQuery":"https://maps.apple.com/?q=MENYA+INOICHI+%E5%AE%87%E6%B2%BB"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (292,72,3,'12:30-13:30','中村藤吉 宇治本店','宇治抹茶百年名店，必吃抹茶甜點','ai','中村藤吉 宇治本店',NULL,4.4,'假日排隊可達1小時，建議先到店頭抽號碼牌再去逛','walking','步行約10分鐘',10,'[{"name":"中村藤吉 宇治本店","googleQuery":"https://www.google.com/maps/search/%E4%B8%AD%E6%9D%91%E8%97%A4%E5%90%89+%E5%AE%87%E6%B2%BB%E6%9C%AC%E5%BA%97","appleQuery":"https://maps.apple.com/?q=%E4%B8%AD%E6%9D%91%E8%97%A4%E5%90%89+%E5%AE%87%E6%B2%BB%E6%9C%AC%E5%BA%97"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (293,72,4,'13:30-15:00','平等院','世界遺產，十圓硬幣上的鳳凰堂','ai','平等院',NULL,4.5,'鳳凰堂內部參觀需另外購票且有人數限制，入園後先去排內部參觀','walking','步行約5分鐘',5,'[{"name":"平等院","googleQuery":"https://www.google.com/maps/search/%E5%B9%B3%E7%AD%89%E9%99%A2+%E5%AE%87%E6%B2%BB","appleQuery":"https://maps.apple.com/?q=%E5%B9%B3%E7%AD%89%E9%99%A2"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (294,72,5,'15:00-16:00','宇治神社・宇治上神社','世界遺產宇治上神社，日本最古老的神社建築','ai','宇治上神社',NULL,4.3,'宇治上神社的兔子御籤很受歡迎，兩間神社相鄰可一起逛','walking','步行約10分鐘',10,'[{"name":"宇治上神社","googleQuery":"https://www.google.com/maps/search/%E5%AE%87%E6%B2%BB%E4%B8%8A%E7%A5%9E%E7%A4%BE","appleQuery":"https://maps.apple.com/?q=%E5%AE%87%E6%B2%BB%E4%B8%8A%E7%A5%9E%E7%A4%BE"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (295,72,6,'16:00-17:00','伊藤久右衛門','宇治抹茶甜點與伴手禮','ai','伊藤久右衛門',NULL,4.2,'抹茶百匯是招牌，伴手禮區可免費試吃抹茶巧克力','walking','步行約10分鐘',10,'[{"name":"伊藤久右衛門","googleQuery":"https://www.google.com/maps/search/%E4%BC%8A%E8%97%A4%E4%B9%85%E5%8F%B3%E8%A1%9B%E9%96%80+%E5%AE%87%E6%B2%BB","appleQuery":"https://maps.apple.com/?q=%E4%BC%8A%E8%97%A4%E4%B9%85%E5%8F%B3%E8%A1%9B%E9%96%80+%E5%AE%87%E6%B2%BB"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (296,72,7,'17:00-17:30','返回京都',NULL,'ai',NULL,NULL,NULL,NULL,'train','JR 奈良線 宇治→京都，約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (297,72,8,'20:00-21:30','晚餐 燒肉甲','已預約 20:00，京都人氣燒肉','ai','燒肉甲',NULL,4.3,'已預約建議準時到，推薦特選和牛拼盤','walking','步行約15分鐘',15,'[{"name":"燒肉甲","googleQuery":"https://www.google.com/maps/search/%E7%84%BC%E8%82%89%E7%94%B2+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E7%84%BC%E8%82%89%E7%94%B2+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (298,72,9,'21:30-22:30','DONQUI 唐吉軻德','京都河原町店，藥妝零食伴手禮','ai','ドン・キホーテ 京都河原町店',NULL,4,'免稅櫃台在1F，購買滿5000日圓可辦理退稅','walking','步行約10分鐘',10,'[{"name":"ドン・キホーテ 京都河原町店","googleQuery":"https://www.google.com/maps/search/%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86+%E4%BA%AC%E9%83%BD%E6%B2%B3%E5%8E%9F%E7%94%BA%E5%BA%97","appleQuery":"https://maps.apple.com/?q=%E3%83%89%E3%83%B3%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86+%E4%BA%AC%E9%83%BD%E6%B2%B3%E5%8E%9F%E7%94%BA"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (299,73,0,'09:00-10:15','進進堂 三条店','京都百年麵包老舖，早餐麵包吃到飽','ai','進進堂 三条店',NULL,4.1,'早餐麵包吃到飽CP值高，假日建議09:00開門前到場排隊',NULL,NULL,NULL,'[{"name":"進進堂 三条店","googleQuery":"https://www.google.com/maps/search/%E9%80%B2%E3%80%85%E5%A0%82+%E4%B8%89%E6%9D%A1%E5%BA%97","appleQuery":"https://maps.apple.com/?q=%E9%80%B2%E9%80%B2%E5%A0%82+%E4%B8%89%E6%9D%A1%E5%BA%97"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (300,73,1,'10:15-11:00','鴨川跳烏龜','鴨川 delta 地標，踩石頭過河','ai','鴨川跳烏龜',NULL,4.4,'石頭間距不大但雨後會滑，穿防滑鞋比較安全','walking','步行約15分鐘',15,'[{"name":"鴨川跳烏龜","googleQuery":"https://www.google.com/maps/search/%E9%B4%A8%E5%B7%9D%E3%83%87%E3%83%AB%E3%82%BF+%E9%A3%9B%E3%81%B3%E7%9F%B3","appleQuery":"https://maps.apple.com/?q=%E9%B4%A8%E5%B7%9D%E3%83%87%E3%83%AB%E3%82%BF"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (301,73,2,'11:00-11:30','村上開新堂','明治創業的西洋菓子老舖，俄羅斯餅乾超搶手','ai','村上開新堂',NULL,4.3,'俄羅斯餅乾常早早售完，建議開店就去買','walking','步行約10分鐘',10,'[{"name":"村上開新堂","googleQuery":"https://www.google.com/maps/search/%E6%9D%91%E4%B8%8A%E9%96%8B%E6%96%B0%E5%A0%82+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E6%9D%91%E4%B8%8A%E9%96%8B%E6%96%B0%E5%A0%82"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (302,73,3,'11:30-12:30','Blue Bottle Coffee 京都六角','町家改建的 Blue Bottle，京都限定飲品','ai','Blue Bottle Coffee 京都六角',NULL,4.4,'京都限定抹茶拿鐵值得嘗試，二樓座位區可欣賞町家庭院','walking','步行約10分鐘',10,'[{"name":"Blue Bottle Coffee 京都六角","googleQuery":"https://www.google.com/maps/search/Blue+Bottle+Coffee+%E4%BA%AC%E9%83%BD%E5%85%AD%E8%A7%92%E3%82%AB%E3%83%95%E3%82%A7","appleQuery":"https://maps.apple.com/?q=Blue+Bottle+Coffee+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (303,73,4,'12:30-14:00','午餐 bigoli kyoto','京都人氣義大利麵','ai','bigoli kyoto',NULL,4.2,'手工義大利麵口感獨特，午餐時段經常客滿建議提早到','walking','步行約5分鐘',5,'[{"name":"bigoli kyoto","googleQuery":"https://www.google.com/maps/search/bigoli+kyoto","appleQuery":"https://maps.apple.com/?q=bigoli+kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (304,73,5,'14:00-15:00','錦市場','京の台所，京漬物、豆乳甜甜圈、章魚蛋','ai','錦市場',NULL,4.3,'多數店家17:00前關門，邊走邊吃注意禮儀（部分店家禁止）','walking','步行約10分鐘',10,'[{"name":"錦市場","googleQuery":"https://www.google.com/maps/search/%E9%8C%A6%E5%B8%82%E5%A0%B4+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E9%8C%A6%E5%B8%82%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (305,73,6,'15:00-16:00','Daiyasu Oyster Bar','錦市場內生蠔吧','ai','Daiyasu Oyster Bar',NULL,4.3,'生蠔產地每日不同，可請店員推薦當日最鮮的',NULL,NULL,NULL,'[{"name":"Daiyasu Oyster Bar","googleQuery":"https://www.google.com/maps/search/Daiyasu+oyster+bar+%E9%8C%A6%E5%B8%82%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=Daiyasu+oyster+bar"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (306,73,7,'16:00-17:00','框框逛街區','Beams → Issey Miyake → human made','user','Beams 京都',NULL,4.1,'各品牌店面散布在巷弄中，建議先查好地圖定位再走','walking','步行約5分鐘',5,'[{"name":"Beams 京都","googleQuery":"https://www.google.com/maps/search/Beams+%E4%BA%AC%E9%83%BD+%E8%97%A4%E4%BA%95%E5%A4%A7%E4%B8%B8","appleQuery":"https://maps.apple.com/?q=Beams+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (307,73,8,'17:00-17:45','WEEKENDERS Coffee','京都精品咖啡代表，站立式咖啡','user','WEEKENDERS Coffee',NULL,4.5,'站立式吧台沒有座位，外帶在河邊喝也很愜意','walking','步行約5分鐘',5,'[{"name":"WEEKENDERS Coffee","googleQuery":"https://www.google.com/maps/search/WEEKENDERS+Coffee+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=WEEKENDERS+Coffee"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (308,73,9,'19:00-20:30','晚餐 charlie izakaya','Walk-in 不需預約，外國人友善居酒屋','user','charlie izakaya',NULL,4.3,'英文菜單齊全氣氛輕鬆，週末晚間可能需等候座位','walking','步行約10分鐘',10,'[{"name":"charlie izakaya","googleQuery":"https://www.google.com/maps/search/charlie+izakaya+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=charlie+izakaya+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (309,73,10,'21:00-22:30','L''Escamoteur','魔術主題酒吧，speakeasy 風格','ai','L''Escamoteur',NULL,4.6,'隱藏入口要留意招牌，調酒師會表演魔術，座位有限建議早到','walking','步行約5分鐘',5,'[{"name":"L''Escamoteur","googleQuery":"https://www.google.com/maps/search/L''Escamoteur+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=L''Escamoteur+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (310,74,0,'09:00-10:00','Fuglen Coffee','挪威奧斯陸精品咖啡京都分店','ai','Fuglen Coffee',NULL,4.5,'北歐風格空間搭配京町家，淺烘焙咖啡是招牌',NULL,NULL,NULL,'[{"name":"Fuglen Coffee","googleQuery":"https://www.google.com/maps/search/Fuglen+Kyoto","appleQuery":"https://maps.apple.com/?q=Fuglen+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (311,74,1,'10:00-10:30','豪門御守','特色御守','ai','豪門御守',NULL,4,'種類繁多的特色御守，可以慢慢挑選喜歡的款式','train','巴士約20分鐘',20,'[{"name":"豪門御守","googleQuery":"https://www.google.com/maps/search/%E8%B1%AA%E9%96%80%E5%BE%A1%E5%AE%88+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E8%B1%AA%E9%96%80%E5%BE%A1%E5%AE%88+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (312,74,2,'10:30-12:30','金閣寺','世界遺產鹿苑寺，金碧輝煌的舍利殿','ai','金閣寺',NULL,4.8,'平日早上人潮較少，門票本身就是御守很有紀念價值','walking','步行約10分鐘',10,'[{"name":"金閣寺","googleQuery":"https://www.google.com/maps/search/%E9%87%91%E9%96%A3%E5%AF%BA+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E9%87%91%E9%96%A3%E5%AF%BA"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (313,74,3,'12:30-13:30','午餐 炭燒鰻','已預約 12:30，京都炭火鰻魚','ai','炭燒鰻',NULL,4.2,'已預約建議準時到，鰻重現烤需等待約15分鐘屬正常','train','巴士約25分鐘',25,'[{"name":"炭燒鰻","googleQuery":"https://www.google.com/maps/search/%E7%82%AD%E7%84%BC%E3%81%86%E3%81%AA%E3%81%8E+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E7%82%AD%E7%84%BC%E3%81%86%E3%81%AA%E3%81%8E+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (314,74,4,'14:00-15:00','ARCHI coffee and wine','午後咖啡，小憩一下','ai','ARCHI coffee and wine',NULL,4.3,'咖啡與自然酒都不錯，下午時段適合悠閒坐著休息','walking','步行約10分鐘',10,'[{"name":"ARCHI coffee and wine","googleQuery":"https://www.google.com/maps/search/ARCHI+coffee+and+wine+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=ARCHI+coffee+and+wine"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (315,74,5,'15:30-16:30','ACTUAL kyoto','京都精品咖啡，獨特空間設計','ai','ACTUAL kyoto',NULL,4.4,'建築空間設計感十足，適合拍照打卡','walking','步行約10分鐘',10,'[{"name":"ACTUAL kyoto","googleQuery":"https://www.google.com/maps/search/ACTUAL+kyoto","appleQuery":"https://maps.apple.com/?q=ACTUAL+kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (316,74,6,'18:30-20:30','晚餐 Sukiyaki Niku no Hiroshige','已預約，壽喜燒名店','ai','肉の寿喜焼 ひろ重',NULL,4.5,'壽喜燒套餐肉量十足，推薦特選和牛等級','walking','步行約15分鐘',15,'[{"name":"肉の寿喜焼 ひろ重","googleQuery":"https://www.google.com/maps/search/Sukiyaki+Niku+no+Hiroshige+Kyoto","appleQuery":"https://maps.apple.com/?q=Niku+no+Hiroshige+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (317,74,7,'20:30-22:00','Bar Rocking Chair','經典京都酒吧','ai','Bar Rocking Chair',NULL,4.5,'正統日式酒吧氛圍沉穩，可請調酒師依喜好客製調酒','walking','步行約10分鐘',10,'[{"name":"Bar Rocking Chair","googleQuery":"https://www.google.com/maps/search/Bar+Rocking+Chair+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=Bar+Rocking+Chair+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (318,75,0,'09:00-10:00','六曜社','昭和喫茶名店，地下室手沖咖啡','ai','六曜社',NULL,4.2,'地下室才是精華，手沖咖啡搭配自製甜甜圈是招牌組合',NULL,NULL,NULL,'[{"name":"六曜社","googleQuery":"https://www.google.com/maps/search/%E5%85%AD%E6%9B%9C%E7%A4%BE+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E5%85%AD%E6%9B%9C%E7%A4%BE+%E4%BA%AC%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (319,75,1,'10:00-12:30','伏見稻荷大社','千本鳥居，稻荷山健行','ai','伏見稻荷大社',NULL,4.6,'早上10點前人較少拍照不用排隊，登頂稻荷山來回約2小時','train','JR 奈良線 京都→稲荷，約5分鐘',5,'[{"name":"伏見稻荷大社","googleQuery":"https://www.google.com/maps/search/%E4%BC%8F%E8%A6%8B%E7%A8%BB%E8%8D%B7%E5%A4%A7%E7%A4%BE","appleQuery":"https://maps.apple.com/?q=%E4%BC%8F%E8%A6%8B%E7%A8%BB%E8%8D%B7%E5%A4%A7%E7%A4%BE"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (320,75,2,'12:30-13:30','午餐 宮川豚衛門','已預約 12:30，京都豬排名店','ai','宮川豚衛門',NULL,4.5,'已預約建議準時到，招牌厚切豬排外酥內嫩','train','JR 稲荷→京都，再步行約15分鐘，約25分鐘',15,'[{"name":"宮川豚衛門","googleQuery":"https://www.google.com/maps/search/%E5%AE%AE%E5%B7%9D%E8%B1%9A%E8%A1%9B%E9%96%80+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E5%AE%AE%E5%B7%9D%E8%B1%9A%E8%A1%9B%E9%96%80"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (321,75,3,'14:00-16:00','三年坂・清水寺','清水舞台眺望京都市區，三年坂老街散策','ai','清水寺',NULL,4.6,'下午光線拍清水舞台最美，三年坂有很多特色小店可以逛','train','巴士約20分鐘',20,'[{"name":"清水寺","googleQuery":"https://www.google.com/maps/search/%E6%B8%85%E6%B0%B4%E5%AF%BA+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E6%B8%85%E6%B0%B4%E5%AF%BA"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (322,75,4,'16:00-17:00','MATCHA GARDEN / 祇園北川半兵衛','抹茶體驗二選一','ai','祇園北川半兵衛',NULL,4.5,'北川半兵衛的抹茶體驗套餐可品嚐不同等級茶葉，建議預約','walking','步行約15分鐘',15,'[{"name":"祇園北川半兵衛","googleQuery":"https://www.google.com/maps/search/%E7%A5%87%E5%9C%92%E5%8C%97%E5%B7%9D%E5%8D%8A%E5%85%B5%E8%A1%9B","appleQuery":"https://maps.apple.com/?q=%E7%A5%87%E5%9C%92%E5%8C%97%E5%B7%9D%E5%8D%8A%E5%85%B5%E8%A1%9B"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (323,75,5,'18:30-20:00','晚餐 大阪燒 世都','京都在地大阪燒','ai','お好み焼き 世都',NULL,4.2,'在地人推薦的老店，自己在鐵板上烤很有趣','walking','步行約15分鐘',15,'[{"name":"お好み焼き 世都","googleQuery":"https://www.google.com/maps/search/%E3%81%8A%E5%A5%BD%E3%81%BF%E7%84%BC%E3%81%8D+%E4%B8%96%E9%83%BD+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=%E3%81%8A%E5%A5%BD%E3%81%BF%E7%84%BC%E3%81%8D+%E4%B8%96%E9%83%BD"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (324,75,6,'20:00-20:30','扭蛋 C-pla','最後機會掃貨扭蛋','ai','C-pla',NULL,4.1,'最後機會買扭蛋，記得多換些零錢','walking','步行約10分鐘',10,'[{"name":"C-pla","googleQuery":"https://www.google.com/maps/search/C-pla+%E4%BA%AC%E9%83%BD+%E6%B2%B3%E5%8E%9F%E7%94%BA","appleQuery":"https://maps.apple.com/?q=C-pla+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (325,76,0,'09:00-10:30','Smart Coffee','昭和元年創業老喫茶，招牌法式吐司與手沖咖啡','ai','Smart Coffee',NULL,4.3,'法式吐司是必點招牌，假日開店前就有人排隊',NULL,NULL,NULL,'[{"name":"Smart Coffee","googleQuery":"https://www.google.com/maps/search/%E3%82%B9%E3%83%9E%E3%83%BC%E3%83%88%E7%8F%88%E7%90%B2%E5%BA%97+%E4%BA%AC%E9%83%BD","appleQuery":"https://maps.apple.com/?q=Smart+Coffee+Kyoto"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (326,76,1,'10:30-11:00','退房・前往京都車站','收拾行李退房','ai',NULL,NULL,NULL,NULL,'train','地下鐵烏丸線 烏丸御池→京都，約5分鐘',5,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (327,76,2,'11:00-12:15','搭乘 Haruka 前往關西機場','WEST QR 搭乘，約75分鐘','ai','京都車站',NULL,4,NULL,'train','Haruka 特急，約75分鐘',75,'[{"name":"京都車站","googleQuery":"https://www.google.com/maps/search/%E4%BA%AC%E9%83%BD%E9%A7%85","appleQuery":"https://maps.apple.com/?q=%E4%BA%AC%E9%83%BD%E9%A7%85"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (328,76,3,'12:30-13:30','午餐 Town Gate Cafe','關西機場 Town Gate 美食街，過安檢後的餐飲區','ai','關西機場 Town Gate',NULL,3.8,'管制區內選擇有限但不用趕時間，建議早點過安檢慢慢吃',NULL,NULL,NULL,'[{"name":"關西機場 Town Gate","googleQuery":"https://www.google.com/maps/search/Town+Gate+Kansai+Airport","appleQuery":"https://maps.apple.com/?q=Town+Gate+Kansai+Airport"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (329,76,4,'14:30','起飛回台北','CI153 關西→桃園 14:30-16:45','ai','關西國際機場',NULL,4,'出發前確認護照與登機證，機場免稅店可最後補貨',NULL,NULL,NULL,'[{"name":"關西國際機場","googleQuery":"https://www.google.com/maps/search/Kansai+International+Airport","appleQuery":"https://maps.apple.com/?q=Kansai+International+Airport"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (330,77,0,'09:35','MM922 台北出發','桃園國際機場出發，飛往沖繩那霸','ai','桃園國際機場',NULL,4,'建議起飛前2小時抵達桃園機場辦理登機及通關手續',NULL,NULL,NULL,'[{"name":"桃園國際機場","lat":25.0797,"lng":121.2342,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (331,77,1,'12:20','抵達那霸機場','入境、領取行李','ai','那霸機場',NULL,3.9,NULL,'train','單軌電車 那霸空港→牧志 約16分鐘 ¥300',16,'[{"name":"那霸機場","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (332,77,2,'13:00-14:30','Check in + 午餐','先至飯店寄放行李，附近國際通覓食','ai','ダイワロイネットホテル那覇国際通り',NULL,4.3,NULL,'train','單軌電車 牧志→首里 約15分鐘 ¥300',15,'[{"name":"ダイワロイネットホテル那覇国際通り","lat":26.2155,"lng":127.6896,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (333,77,3,'14:30-16:30','首里城公園','琉球王國象徵，世界遺產。正殿重建中仍值得參觀城牆、守禮門與展覽','ai','首里城公園',NULL,4.4,'正殿重建中可免費參觀工地見學區，建議從守禮門拍照後往城牆方向走','train','單軌電車 首里→牧志 約15分鐘 ¥300',15,'[{"name":"首里城公園","lat":26.2172,"lng":127.7194,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (334,77,4,'16:30-17:30','國際通散步','那霸最熱鬧的1.6公里商店街，伴手禮、沖繩料理、藥妝一次搞定','ai','那霸國際通',NULL,4.2,'巷弄內的平和通和市場本通比大街更好逛且價格便宜','walk','步行至牧志公設市場 約5分鐘',5,'[{"name":"那霸國際通","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (335,77,5,'17:30-18:30','牧志公設市場','那霸的廚房！1F 買鮮魚，2F 代客料理。色彩鮮豔的熱帶魚、島豆腐必體驗','ai','那覇牧志公設市場',NULL,4.3,'1F 買完海鮮直接拿到 2F 代客料理，料理費每道約 ¥500','walk','步行至晚餐餐廳 約10分鐘',10,'[{"name":"那覇牧志公設市場","lat":26.2157,"lng":127.6913,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (336,77,6,'18:30-19:30','晚餐','國際通周邊晚餐','ai','那霸國際通',NULL,4,'週五晚上國際通人潮多，熱門店建議提早訂位',NULL,NULL,NULL,'[{"name":"那霸國際通","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (337,78,0,'08:30-10:00','出發前往南部','從那霸巴士總站搭 38 番巴士前往南城方面','ai','那霸巴士總站',NULL,3.5,NULL,'bus','38 番巴士至「齋場御嶽入口」約60分鐘',60,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","lat":26.2124,"lng":127.6795,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (338,78,1,'10:00-11:15','齋場御嶽','琉球最高聖地，世界遺產。穿過三角形岩縫可遠眺久高島，神聖莊嚴','ai','齋場御嶽',NULL,4.5,'需在南城市地域物產館購票再步行前往，石板路滑建議穿防滑鞋','walk','步行至知念岬公園 約5分鐘',5,'[{"name":"齋場御孯","googleQuery":"https://www.google.com/maps/search/%E6%96%8E%E5%A0%B4%E5%BE%A1%E5%B6%BD","appleQuery":"https://maps.apple.com/?q=%E6%96%8E%E5%A0%B4%E5%BE%A1%E5%B6%BD","lat":26.1461,"lng":127.7867,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (339,78,2,'11:15-12:00','知念岬公園','免費海岬公園，270度太平洋全景，可遠眺久高島和 Komaka 島','ai','知念岬公園',NULL,4.4,'免費入園且有停車場，風大建議抓好帽子和隨身物品',NULL,NULL,NULL,'[{"name":"知念岬公園","googleQuery":"https://www.google.com/maps/search/%E7%9F%A5%E5%BF%B5%E5%B2%AC%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E7%9F%A5%E5%BF%B5%E5%B2%AC%E5%85%AC%E5%9C%92","lat":26.1516,"lng":127.7968,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (340,78,3,'12:00-13:30','午餐','南城周邊午餐','ai','南城市周邊',NULL,4,'南城餐廳選擇較少，建議提早出發避免等候','bus','搭巴士至「玉泉洞前」約30分鐘',30,'[{"name":"南城市周邀","googleQuery":"https://www.google.com/maps/search/%E5%8D%97%E5%9F%8E%E5%B8%82+%E6%B2%96%E7%B8%84","appleQuery":"https://maps.apple.com/?q=%E5%8D%97%E5%9F%8E%E5%B8%82+%E6%B2%96%E7%B8%84","lat":26.1575,"lng":127.7692,"geocode_status":"review"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (341,78,4,'13:30-16:30','沖繩世界（玉泉洞）','30萬年鐘乳石洞穴，洞內常年21°C。園區還有琉球村、太鼓表演、傳統工藝體驗','ai','沖繩世界（玉泉洞）',NULL,4.2,'洞內涼爽但濕滑，穿好走的鞋；太鼓表演時刻表建議入園時先確認','bus','83 番巴士回那霸巴士總站 約50分鐘',50,'[{"name":"沖繄世界（玉泉洞）","googleQuery":"https://www.google.com/maps/search/%E3%81%8A%E3%81%8D%E3%81%AA%E3%82%8F%E3%83%AF%E3%83%BC%E3%83%AB%E3%83%89+%E7%8E%89%E6%B3%89%E6%B4%9E","appleQuery":"https://maps.apple.com/?q=%E3%81%8A%E3%81%8D%E3%81%AA%E3%82%8F%E3%83%AF%E3%83%BC%E3%83%AB%E3%83%89+%E7%8E%89%E6%B3%89%E6%B4%9E","lat":26.1276,"lng":127.7617,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (342,78,5,'17:30-18:30','回到那霸','巴士返回那霸市區','ai','那霸巴士總站',NULL,3.5,'83 番巴士末班約 18:00 發車，錯過需轉計程車回那霸',NULL,NULL,NULL,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","lat":26.2124,"lng":127.6795,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (343,78,6,'18:30-19:30','晚餐','回到那霸市區晚餐','ai','那霸國際通',NULL,4,'週六晚間國際通周邊居酒屋人氣高，建議預約','walk','步行至國際通 約5分鐘',5,'[{"name":"那霸國際通","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (344,78,7,'19:30-21:00','國際通散步','那霸最熱鬧的一條街，全長約1.6公里，兩旁伴手禮店、居酒屋、街頭表演林立，夜晚燈光璀璨適合悠閒散步','user','國際通',NULL,4.3,'週六晚間人潮多，注意隨身物品；牧志公設市場方向巷弄內有特色小店可逛',NULL,NULL,NULL,'[{"name":"國際通","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (345,79,0,'07:30-10:00','搭高速巴士前往北部','搭 117 番やんばる急行巴士，從縣廳前直達美麗海水族館，約2.5小時','ai','縣廳前站',NULL,3.5,NULL,'bus','117 番高速巴士 縣廳前→記念公園前 約150分鐘',150,'[{"name":"縣廳前站","lat":26.2162,"lng":127.6857,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (346,79,1,'10:00-13:00','沖繩美麗海水族館','必看黑潮之海！巨大鯨鯊與鬼蝠魟悠遊的壯觀水槽。園區內還有海龜館、海豚表演','ai','沖繩美麗海水族館',NULL,4.5,'16:00 後入場門票半價，海豚表演一天多場建議先查時刻表',NULL,NULL,NULL,'[{"name":"沖繄美麗海水族館","lat":26.6938,"lng":127.8783,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (347,79,2,'13:00-14:30','午餐','水族館周邊或本部町午餐','ai','海洋博公園周邊',NULL,4,'園區內餐廳中午排隊長，可考慮開車到本部町街上用餐','walk','步行至備瀨福木林道 約15分鐘',15,'[{"name":"海洋博公園周邀","lat":26.6952,"lng":127.8761,"geocode_status":"review"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (348,79,3,'14:30-16:00','備瀨福木林道','約2萬棵福木形成的綠色隧道，盡頭是美麗海灘。可租腳踏車悠閒遊覽','ai','備瀨福木林道',NULL,4.5,'入口處可租腳踏車約 ¥300/小時，走到盡頭海灘可看到伊江島','bus','117 番高速巴士回程 記念公園前→縣廳前 約150分鐘',150,'[{"name":"備瀮福木林道","lat":26.7098,"lng":127.866,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (349,79,4,'16:00-19:00','搭巴士返回那霸','搭 117 番回程巴士返回那霸市區','ai','那霸巴士總站',NULL,3.5,'117 番末班約 17:30 從記念公園前發車，務必提前到站候車',NULL,NULL,NULL,'[{"name":"那霸巴士總站","lat":26.2124,"lng":127.6795,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (350,79,5,'19:00-20:00','晚餐','回到那霸晚餐','ai','那霸國際通',NULL,4,'北部回程車程長，可在巴士上先決定晚餐地點預約',NULL,NULL,NULL,'[{"name":"那霸國際通","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (351,80,0,'08:30-09:45','出發前往中部','搭 28 番或 29 番巴士前往北谷美國村','ai','那霸巴士總站',NULL,3.5,NULL,'bus','28 番巴士至「美浜アメリカンビレッジ入口」約55分鐘',55,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","lat":26.2124,"lng":127.6795,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (352,80,1,'09:45-12:00','美國村（北谷）','充滿美式風情的商圈，彩色建築、摩天輪、海濱步道。逛街拍照看海一次滿足','ai','美國村（北谷）',NULL,4,'日落海灘拍夕陽很美，摩天輪上可俯瞰整個商圈和海岸線',NULL,NULL,NULL,'[{"name":"美國村（北谷）","googleQuery":"https://www.google.com/maps/search/%E7%BE%8E%E6%B5%9C%E3%82%A2%E3%83%A1%E3%83%AA%E3%82%AB%E3%83%B3%E3%83%93%E3%83%AC%E3%83%83%E3%82%B8","appleQuery":"https://maps.apple.com/?q=%E7%BE%8E%E6%B5%9C%E3%82%A2%E3%83%A1%E3%83%AA%E3%82%AB%E3%83%B3%E3%83%93%E3%83%AC%E3%83%83%E3%82%B8","lat":26.3108,"lng":127.7543,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (353,80,2,'12:00-13:30','午餐','美國村周邊午餐','ai','美國村（北谷）',NULL,4,'美國村內餐廳選擇多，平日午餐較不用排隊','bus','搭巴士至讀谷「殘波岬入口」約40分鐘',40,'[{"name":"美國村（北谷）","googleQuery":"https://www.google.com/maps/search/%E7%BE%8E%E6%B5%9C%E3%82%A2%E3%83%A1%E3%83%AA%E3%82%AB%E3%83%B3%E3%83%93%E3%83%AC%E3%83%83%E3%82%B8","appleQuery":"https://maps.apple.com/?q=%E7%BE%8E%E6%B5%9C%E3%82%A2%E3%83%A1%E3%83%AA%E3%82%AB%E3%83%B3%E3%83%93%E3%83%AC%E3%83%83%E3%82%B8","lat":26.3108,"lng":127.7543,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (354,80,3,'13:30-14:45','殘波岬燈台','高30公尺白色燈塔，可登頂俯瞰東海壯闊斷崖。入場 ¥400','ai','殘波岬燈台',NULL,4.6,'燈塔螺旋樓梯較窄且陡，恐高者可在下方斷崖步道欣賞海景',NULL,NULL,NULL,'[{"name":"殘波岬燈台","googleQuery":"https://www.google.com/maps/search/%E6%AE%8B%E6%B3%A2%E5%B2%AC%E7%81%AF%E5%8F%B0","appleQuery":"https://maps.apple.com/?q=%E6%AE%8B%E6%B3%A2%E5%B2%AC%E7%81%AF%E5%8F%B0","lat":26.4486,"lng":127.7178,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (355,80,4,'14:45-16:00','御菓子御殿（讀谷店）','紅芋塔工廠見學，免費試吃，買伴手禮的好地方','ai','御菓子御殿 讀谷店',NULL,4.2,'工廠產線透過玻璃可參觀，免費試吃紅芋塔，伴手禮這裡買最齊全','bus','搭巴士或計程車至萬座毛 約35分鐘',35,'[{"name":"御菓子御殿 讀谷店","googleQuery":"https://www.google.com/maps/search/%E5%BE%A1%E8%8F%93%E5%AD%90%E5%BE%A1%E6%AE%BF+%E8%AA%AD%E8%B0%B7%E5%BA%97","appleQuery":"https://maps.apple.com/?q=%E5%BE%A1%E8%8F%93%E5%AD%90%E5%BE%A1%E6%AE%BF+%E8%AA%AD%E8%B0%B7%E5%BA%97","lat":26.3979,"lng":127.7434,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (356,80,5,'16:00-17:00','萬座毛','象鼻岩絕景，步道約20分鐘走完一圈。入場 ¥100','ai','萬座毛',NULL,4.3,'新設的木棧步道約20分鐘走完，傍晚夕陽西下時拍象鼻岩最美','bus','120 番巴士回那霸 約90分鐘',90,'[{"name":"萬座毛","googleQuery":"https://www.google.com/maps/search/%E4%B8%87%E5%BA%A7%E6%AF%9B+%E6%B2%96%E7%B8%84","appleQuery":"https://maps.apple.com/?q=%E4%B8%87%E5%BA%A7%E6%AF%9B+%E6%B2%96%E7%B8%84","lat":26.5017,"lng":127.7248,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (357,80,6,'18:30-19:30','晚餐','回到那霸晚餐','ai','那霸國際通',NULL,4,'週一部分餐廳公休，出發前先確認營業時間',NULL,NULL,NULL,'[{"name":"那霸國際通","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","lat":26.2165,"lng":127.6879,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (358,81,0,'09:00-10:00','波上宮','建於懸崖上的神社，沖繩最具代表性的信仰中心。旁邊有波之上海灘','ai','波上宮',NULL,4.2,'御守種類豐富適合當伴手禮，旁邊波之上海灘可快速踏浪','walk','步行回飯店 約15分鐘',15,'[{"name":"波上宮","googleQuery":"https://www.google.com/maps/search/%E6%B3%A2%E4%B8%8A%E5%AE%AE+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E6%B3%A2%E4%B8%8A%E5%AE%AE+%E9%82%A3%E8%A6%87","lat":26.2252,"lng":127.679,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (359,81,1,'10:00-10:30','Check out + 寄放行李','退房，將行李寄放飯店','ai','ダイワロイネットホテル那覇国際通り',NULL,4.3,NULL,'bus','免費接駁巴士至瀨長島 約25分鐘',25,'[{"name":"ダイワロイネットホテル那詪国際通り","googleQuery":"https://www.google.com/maps/search/%E3%83%80%E3%82%A4%E3%83%AF%E3%83%AD%E3%82%A4%E3%83%8D%E3%83%83%E3%83%88%E3%83%9B%E3%83%86%E3%83%AB%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E3%83%80%E3%82%A4%E3%83%AF%E3%83%AD%E3%82%A4%E3%83%8D%E3%83%83%E3%83%88%E3%83%9B%E3%83%86%E3%83%AB%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","lat":26.2155,"lng":127.6896,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (360,81,2,'11:00-12:00','瀨長島 Umikaji Terrace','白色地中海風露台商場，可看飛機起降、喝咖啡、拍照。離機場僅15分鐘','ai','瀨長島 Umikaji Terrace',NULL,4.2,'有免費接駁巴士往返那霸機場，是搭機前最後悠閒逛街的好地方',NULL,NULL,NULL,'[{"name":"瀮長島 Umikaji Terrace","googleQuery":"https://www.google.com/maps/search/%E7%80%AC%E9%95%B7%E5%B3%B6%E3%82%A6%E3%83%9F%E3%82%AB%E3%82%B8%E3%83%86%E3%83%A9%E3%82%B9","appleQuery":"https://maps.apple.com/?q=%E7%80%AC%E9%95%B7%E5%B3%B6%E3%82%A6%E3%83%9F%E3%82%AB%E3%82%B8%E3%83%86%E3%83%A9%E3%82%B9","lat":26.1762,"lng":127.6481,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (361,81,3,'12:00-13:30','午餐','瀨長島或那霸市區最後一餐','ai','瀨長島 Umikaji Terrace',NULL,4,'瀨長島上有多家餐廳可邊看海邊用餐，注意回機場接駁車時間','bus','免費接駁巴士至那霸機場 約15分鐘',15,'[{"name":"瀮長島 Umikaji Terrace","googleQuery":"https://www.google.com/maps/search/%E7%80%AC%E9%95%B7%E5%B3%B6%E3%82%A6%E3%83%9F%E3%82%AB%E3%82%B8%E3%83%86%E3%83%A9%E3%82%B9","appleQuery":"https://maps.apple.com/?q=%E7%80%AC%E9%95%B7%E5%B3%B6%E3%82%A6%E3%83%9F%E3%82%AB%E3%82%B8%E3%83%86%E3%83%A9%E3%82%B9","lat":26.1762,"lng":127.6481,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (362,81,4,'14:30','前往那霸機場','提前2小時到機場，辦理登機・免稅店最後購物','ai','那霸機場',NULL,3.9,'國內線航廈2F有DFS免稅店，可把握最後購物時間',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (363,81,5,'16:45','MM929 回程出發','那霸飛回台北桃園，17:20 抵達','ai','那霸機場',NULL,4,'樂桃航空手提行李限7公斤，超重需提前加購託運',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (415,88,0,'10:00','沖繩那霸美居飯店 退房',NULL,'ai','メルキュール沖縄那覇','33 155 267*37',4,'退房後可請櫃台寄放行李，搭計程車或單軌電車到機場（Day 6 已還車，無自駕車）','taxi','搭計程車約15分鐘',15,'[{"name":"メルキュール沖縄那覇","googleQuery":"https://www.google.com/maps/search/%E3%83%A1%E3%83%AB%E3%82%AD%E3%83%A5%E3%83%BC%E3%83%AB%E6%B2%96%E7%B8%84%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E3%83%A1%E3%83%AB%E3%82%AD%E3%83%A5%E3%83%BC%E3%83%AB%E6%B2%96%E7%B8%84%E9%82%A3%E8%A6%87","mapcode":"33 155 267*37","lat":26.2109,"lng":127.682,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (416,88,1,'10:15','機場午餐','在那霸機場用午餐','ai','那覇空港 国内線ターミナル','33 122 298*54',4,'空港食堂在 1F 到達大廳旁較隱密，價格平實是在地人推薦的隱藏名店','walk','同機場',NULL,'[{"name":"那覇空港 国内線ターミナル","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E7%A9%BA%E6%B8%AF","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E7%A9%BA%E6%B8%AF","mapcode":"33 122 298*54","lat":26.1958,"lng":127.6458,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (417,88,2,'10:15-11:15','那霸機場退稅','辦理退稅手續，集中處理免稅商品','ai','那覇空港 国内線ターミナル','33 122 298*54',4,'提前整理好免稅單據與商品，人多時排隊需 30 分鐘以上','walk','同機場',NULL,'[{"name":"那覇空港 国内線ターミナル","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E7%A9%BA%E6%B8%AF","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E7%A9%BA%E6%B8%AF","mapcode":"33 122 298*54","lat":26.1958,"lng":127.6458,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (418,88,3,'11:15-12:15','那霸機場','樂桃 MM927，辦理登機、機場購物、回程','ai','那霸機場','33 122 298*54',4,'樂桃在 LCC 航廈，建議起飛前 2 小時到機場辦理登機。機場還能買到：⑥Royce鹽巧克力洋芋片⭐5、⑧砂糖樹夾心餅乾⭐4.5、⑨南風堂辣味蝦餅⭐5','walk','同機場',NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","mapcode":"33 122 298*54","lat":26.1958,"lng":127.6458,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (419,89,0,'10:45','抵達那霸機場','入境、領取行李','ai','那霸機場','33 002 519*00',3.9,'入境後往國內線方向走有便利商店可補給飲料','train','單軌電車 那霸空港→美榮橋 約15分鐘',15,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","mapcode":"33 002 519*00","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (420,89,1,'12:10-12:40','租車取車','タイムズカー 美栄橋駅前店｜辦理租車手續、熟悉車輛操作（日本靠左行駛）','ai','タイムズカー 美栄橋駅前店','33 157 393*30',4,NULL,'car','美栄橋→MEGA唐吉軻德 宜野灣店 約15分鐘（國道58號北上）',15,'[{"name":"タイムズカー 美栄橋駅前店","googleQuery":"https://www.google.com/maps/search/%E3%82%BF%E3%82%A4%E3%83%A0%E3%82%BA%E3%82%AB%E3%83%BC+%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85%E5%89%8D%E5%BA%97","appleQuery":"https://maps.apple.com/?q=%E3%82%BF%E3%82%A4%E3%83%A0%E3%82%BA%E3%82%AB%E3%83%BC+%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85%E5%89%8D%E5%BA%97","mapcode":"33 157 393*30","lat":26.2172,"lng":127.6918,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (421,89,2,'13:00-15:00','MEGA唐吉軻德 宜野灣店（含午餐）','沖繩最大級唐吉軻德！佔地超廣，免稅商品齊全。午餐直接在店內解決：惣菜區有現炸唐揚炸雞、可樂餅、天婦羅；弁当區有「偏愛めし」系列大份量便當；還有「はみだしすぎィ」系列爆餡飯糰（¥298 起），買了直接在店內或車上吃','user','MEGAドン・キホーテ 宜野湾店','33 434 024*12',3.9,'比北谷店大很多更好逛，免稅滿 ¥5,000 記得帶護照；駐車場 289 台免費。必買伴手禮：③沖繩黑糖夏威夷豆巧克力⭐5、⑥Royce鹽巧克力洋芋片⭐5、⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5','car','宜野灣→北谷 Vessel Hotel 約10分鐘',10,'[{"name":"MEGAドン・キホーテ 宜野湾店","googleQuery":"https://www.google.com/maps/search/MEGA%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86+%E5%AE%9C%E9%87%8E%E6%B9%BE%E5%BA%97","appleQuery":"https://maps.apple.com/?q=MEGA%E3%83%89%E3%83%B3%E3%83%BB%E3%82%AD%E3%83%9B%E3%83%BC%E3%83%86+%E5%AE%9C%E9%87%8E%E6%B9%BE%E5%BA%97","mapcode":"33 434 024*12","lat":26.2819,"lng":127.7305,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (422,89,3,'15:10-15:30','Check in Vessel Hotel','放行李，換裝準備玩水','ai','Vessel Hotel Campana Okinawa','33 526 450*63',4.5,NULL,'walking','步行 約3分鐘',3,'[{"name":"Vessel Hotel Campana Okinawa","googleQuery":"https://www.google.com/maps/search/Vessel+Hotel+Campana+Okinawa","appleQuery":"https://maps.apple.com/?q=Vessel+Hotel+Campana+Okinawa","mapcode":"33 526 450*63","lat":26.3142,"lng":127.7541,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (423,89,4,'15:30-18:30','美國村＋Sunset Beach','美國村內逛街購物，Sunset Beach 沙灘戲水。異國風情的彩色商圈，集結服飾店、雜貨店、餐廳','ai','American Village Chatan Okinawa','33 526 450*63',4.2,'Sunset Beach 傍晚夕陽超美，建議帶防水袋裝手機拍照','walking','步行回飯店沖洗 約3分鐘',3,'[{"label":"美國村","name":"American Village Chatan Okinawa","googleQuery":"https://www.google.com/maps/search/American+Village+Chatan+Okinawa","appleQuery":"https://maps.apple.com/?q=American+Village+Chatan+Okinawa","mapcode":"33 526 450*63","lat":26.3142,"lng":127.7541,"geocode_status":"ok"},{"label":"Sunset Beach","name":"Sunset Beach Chatan Okinawa","googleQuery":"https://www.google.com/maps/search/Sunset+Beach+Chatan+Okinawa","appleQuery":"https://maps.apple.com/?q=Sunset+Beach+Chatan+Okinawa","mapcode":"33 526 419*00","lat":26.3173,"lng":127.7513,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (424,89,5,'19:00-20:30','美國村晚餐＋散步','美國村商圈內餐廳選擇豐富，用餐後沿海岸散步看夕陽夜景','ai','北谷美國村',NULL,4.2,'焼肉きんぐ暑假要 EPARK 預約；サムズマウイ鐵板秀很精彩建議提前預約；MARUMARO 午休到17:30注意時段',NULL,NULL,NULL,'[{"name":"北谷美國村","googleQuery":"https://www.google.com/maps/search/American+Village+Chatan+Okinawa","appleQuery":"https://maps.apple.com/?q=American+Village+Chatan+Okinawa","lat":26.3142,"lng":127.7541,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (425,89,6,'21:00','飯店頂樓海景溫泉',NULL,'ai','Vessel Hotel Campana Okinawa',NULL,4.5,'邊泡湯邊看夜景',NULL,NULL,NULL,'[{"name":"Vessel Hotel Campana Okinawa","googleQuery":"https://www.google.com/maps/search/Vessel+Hotel+Campana+Okinawa","appleQuery":"https://maps.apple.com/?q=Vessel+Hotel+Campana+Okinawa","lat":26.3142,"lng":127.7541,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (426,90,0,'08:30','出發前往真榮田岬',NULL,'ai',NULL,NULL,NULL,NULL,'car','北谷→真榮田岬 約30分鐘（國道58號北上）',30,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (427,90,1,'09:00-11:00','青之洞窟浮潛','沖繩人氣 No.1 浮潛景點！陽光折射讓洞窟內海水呈現夢幻藍光，熱帶魚群環繞身旁','ai','真榮田岬 青の洞窟','206 062 685*77',4.4,'早上場海況最穩定且光線最美，建議選搭船方案免爬階梯',NULL,NULL,NULL,'[{"name":"真榮田岬 青の洞窟","googleQuery":"https://www.google.com/maps/search/%E7%9C%9F%E6%A6%AE%E7%94%B0%E5%B2%AC+%E9%9D%92%E3%81%AE%E6%B4%9E%E7%AA%9F","appleQuery":"https://maps.apple.com/?q=%E7%9C%9F%E6%A6%AE%E7%94%B0%E5%B2%AC+%E9%9D%92%E3%81%AE%E6%B4%9E%E7%AA%9F","mapcode":"206 062 685*77","lat":26.4262,"lng":127.7815,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (428,90,2,'11:00-12:00','休息沖洗','浮潛結束後在店家沖洗更衣，整理裝備休息一下','ai','真榮田岬 青の洞窟','206 062 685*77',4.4,'多數浮潛店家提供免費淋浴設備和更衣室',NULL,NULL,NULL,'[{"name":"真榮田岬 青の洞窟","googleQuery":"https://www.google.com/maps/search/%E7%9C%9F%E6%A6%AE%E7%94%B0%E5%B2%AC+%E9%9D%92%E3%81%AE%E6%B4%9E%E7%AA%9F","appleQuery":"https://maps.apple.com/?q=%E7%9C%9F%E6%A6%AE%E7%94%B0%E5%B2%AC+%E9%9D%92%E3%81%AE%E6%B4%9E%E7%AA%9F","mapcode":"206 062 685*77","lat":26.4262,"lng":127.7815,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (429,90,3,'12:00-13:30','恩納午餐','恩納村一帶覓食，浮潛後補充體力','ai','恩納村',NULL,4.1,'蒜蝦飯粉紅小屋很好認，路邊有停車位','car','恩納→瀨底島 約40分鐘（國道58號北上→瀨底大橋）',40,'[{"name":"恩納村","googleQuery":"https://www.google.com/maps/search/%E6%81%A9%E7%B4%8D%E6%9D%91+%E5%9B%BD%E9%81%9358%E5%8F%B7","appleQuery":"https://maps.apple.com/?q=%E6%81%A9%E7%B4%8D%E6%9D%91+%E5%9B%BD%E9%81%9358%E5%8F%B7","lat":26.4015,"lng":127.8203,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (430,90,4,'14:10-17:10','瀨底海灘戲水','沖繩本島數一數二美的天然海灘！白沙細緻，海水透明度極高，午後戲水最舒服','ai','瀬底ビーチ','206 822 241*00',4.3,'海灘有淋浴設備和置物櫃（需付費），建議自帶浮潛面鏡','car','瀨底島→Super Hotel 名護 約20分鐘',20,'[{"name":"瀬底ビーチ","googleQuery":"https://www.google.com/maps/search/%E7%80%AC%E5%BA%95%E3%83%93%E3%83%BC%E3%83%81","appleQuery":"https://maps.apple.com/?q=%E7%80%AC%E5%BA%95%E3%83%93%E3%83%BC%E3%83%81","mapcode":"206 822 241*00","lat":26.6507,"lng":127.8683,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (431,90,5,'17:30','Check in Super Hotel 名護','放好行李休息一下，準備晚餐出門','ai','スーパーホテル沖縄・名護','206 598 283*00',4.2,'入住時可向櫃台索取溫泉使用說明及周邊餐廳地圖',NULL,NULL,NULL,'[{"name":"スーパーホテル沖縄・名護","googleQuery":"https://www.google.com/maps/search/%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","appleQuery":"https://maps.apple.com/?q=%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","mapcode":"206 598 283*00","lat":26.5918,"lng":127.9776,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (432,90,6,'19:00-20:15','名護晚餐','名護市區覓食，步行或短程車程可達','ai','名護市',NULL,4,'安安名護店步行可達超平價；ふりっぱー牛排是在地人最愛，週三公休注意',NULL,NULL,NULL,'[{"name":"名護市","googleQuery":"https://www.google.com/maps/search/%E5%90%8D%E8%AD%B7%E5%B8%82","appleQuery":"https://maps.apple.com/?q=%E5%90%8D%E8%AD%B7%E5%B8%82","lat":26.5918,"lng":127.9776,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (433,90,7,'20:30','飯店溫泉（万座深海の湯）','晚餐後回飯店泡溫泉，消除一天的疲勞','ai','スーパーホテル沖縄・名護',NULL,4.2,'天然温泉，疲勞盡消',NULL,NULL,NULL,'[{"name":"スーパーホテル沖縄・名護","googleQuery":"https://www.google.com/maps/search/%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","appleQuery":"https://maps.apple.com/?q=%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","lat":26.5918,"lng":127.9776,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (434,91,0,'08:00','出發前往許田',NULL,'ai',NULL,NULL,NULL,NULL,'car','名護→道之驛許田 約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (435,91,1,'08:10-08:40','道之驛許田','沖繩人氣最高休息站！必買沙翁（サーターアンダギー）、黑糖、在地農產。還有折扣水族館門票','ai','道の駅許田','206 476 710*00',4,'水族館門票在這裡買比官網便宜，沙翁現炸的最好吃','car','許田→美麗海水族館 約20分鐘（國道449號）',20,'[{"name":"道の駅許田","googleQuery":"https://www.google.com/maps/search/%E9%81%93%E3%81%AE%E9%A7%85%E8%A8%B1%E7%94%B0","appleQuery":"https://maps.apple.com/?q=%E9%81%93%E3%81%AE%E9%A7%85%E8%A8%B1%E7%94%B0","mapcode":"206 476 710*00","lat":26.5477,"lng":127.9792,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (436,91,2,'09:00-13:00','美麗海水族館','世界最大級水族館！巨大「黑潮之海」水槽可近距離觀賞鯨鯊和鬼蝠魟。11:00 海豚秀必看','ai','沖縄美ら海水族館','553 075 797*00',4.6,'停 P7 離入口最近；黑潮之海水槽旁的咖啡座可邊喝邊看鯨鯊。出口禮品店必買：⑤紅芋脆餅（美麗海水族館版）⭐4','car','水族館→本部午餐 約5分鐘',5,'[{"name":"沖縄美ら海水族館","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E7%BE%8E%E3%82%89%E6%B5%B7%E6%B0%B4%E6%97%8F%E9%A4%A8","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E7%BE%8E%E3%82%89%E6%B5%B7%E6%B0%B4%E6%97%8F%E9%A4%A8","mapcode":"553 075 797*00","lat":26.6938,"lng":127.8783,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (437,91,3,'13:05-14:35','本部午餐','水族館附近覓食，本部町在地美食','ai','美ら海水族館周辺',NULL,4.1,'きしもと食堂是百年老店常排隊，建議避開正午尖峰；もとぶ牧場午餐L.O.14:00要注意','car','本部→古宇利島 約35分鐘（今帰仁経由→古宇利大橋）',35,'[{"name":"美ら海水族館周辺","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E7%BE%8E%E3%82%89%E6%B5%B7%E6%B0%B4%E6%97%8F%E9%A4%A8","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E7%BE%8E%E3%82%89%E6%B5%B7%E6%B0%B4%E6%97%8F%E9%A4%A8","lat":26.6938,"lng":127.8783,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (438,91,4,'15:10-19:10','古宇利島','沖繩北部必訪離島！全長 1,960m 的古宇利大橋壯觀絕美，島上有浪漫心型岩、白沙海灘，蝦蝦飯更是必嚐','ai','古宇利島','485 662 831*22',4.3,'建議順序：大橋拍照→海灘戲水→蝦蝦飯→心型岩看夕陽','car','古宇利島→名護 約30分鐘',30,'[{"name":"古宇利島","googleQuery":"https://www.google.com/maps/search/%E5%8F%A4%E5%AE%87%E5%88%A9%E3%83%93%E3%83%BC%E3%83%81","appleQuery":"https://maps.apple.com/?q=%E5%8F%A4%E5%AE%87%E5%88%A9%E3%83%93%E3%83%BC%E3%83%81","mapcode":"485 662 831*22","lat":26.8328,"lng":128.024,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (439,91,5,'19:45-21:00','名護晚餐','名護市區覓食，與 D2 不重複的餐廳選擇','ai','名護市',NULL,4,'暖暮拉麵晚間常排隊，建議提早或避開 19:00 尖峰',NULL,NULL,NULL,'[{"name":"名護市","googleQuery":"https://www.google.com/maps/search/%E5%90%8D%E8%AD%B7%E5%B8%82","appleQuery":"https://maps.apple.com/?q=%E5%90%8D%E8%AD%B7%E5%B8%82","lat":26.5918,"lng":127.9776,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (440,91,6,'21:15','飯店溫泉（万座深海の湯）','晚餐後回飯店泡溫泉，一天的疲勞全消','ai','スーパーホテル沖縄・名護',NULL,4.2,'天然温泉，疲勞盡消',NULL,NULL,NULL,'[{"name":"スーパーホテル沖縄・名護","googleQuery":"https://www.google.com/maps/search/%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","appleQuery":"https://maps.apple.com/?q=%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC%E3%83%9B%E3%83%86%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%BB%E5%90%8D%E8%AD%B7","lat":26.5918,"lng":127.9776,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (441,92,0,'09:00','出發前往伊芸SA',NULL,'ai',NULL,NULL,NULL,NULL,'car','名護→沖縄自動車道 約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (442,92,1,'09:25-09:45','伊芸SA 休息（下り）','沖縄自動車道上的絕景休息站！金武灣＋太平洋全景展望台，不需下交流道','ai','伊芸サービスエリア（下り）','206 200 543*00',4,'必吃 SA 限定月桃田芋ジューシー，展望台可看金武灣全景','car','伊芸SA→北中城IC→AEON Mall 來客夢 約30分鐘',30,'[{"name":"伊芸サービスエリア（下り）","googleQuery":"https://www.google.com/maps/search/%E4%BC%8A%E8%8A%B8%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%82%A8%E3%83%AA%E3%82%A2+%E4%B8%8B%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E4%BC%8A%E8%8A%B8%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%82%A8%E3%83%AA%E3%82%A2+%E4%B8%8B%E3%82%8A","mapcode":"206 200 543*00","lat":26.4538,"lng":127.9247,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (443,92,2,'10:15-15:00','AEON Mall 沖繩來客夢','沖繩最大購物中心！寶可夢中心、UNIQLO、美食廣場，一整天慢慢逛','ai','イオンモール沖縄ライカム','33 530 406*00',4.2,'週六人潮多建議開門就到，寶可夢中心沖繩限定商品必看；中午在 3F 美食廣場用餐。AEON STYLE 3F 必買伴手禮：③沖繩黑糖夏威夷豆巧克力⭐5、⑥Royce鹽巧克力洋芋片⭐5、⑦沖繩褐藻&苦瓜香鬆⭐4、⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5','car','AEON Mall→那霸（加油站）約20分鐘',20,'[{"name":"イオンモール沖縄ライカム","googleQuery":"https://www.google.com/maps/search/%E3%82%A4%E3%82%AA%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%A9%E3%82%A4%E3%82%AB%E3%83%A0","appleQuery":"https://maps.apple.com/?q=%E3%82%A4%E3%82%AA%E3%83%B3%E3%83%A2%E3%83%BC%E3%83%AB%E6%B2%96%E7%B8%84%E3%83%A9%E3%82%A4%E3%82%AB%E3%83%A0","mapcode":"33 530 406*00","lat":26.3571,"lng":127.7686,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (444,92,3,'15:30-16:20','加油＋還車手續','先到崇元寺店加油，再至美栄橋駅前店還車','ai','ENEOS Dr.Drive 崇元寺店',NULL,4,NULL,'walking','步行至東橫inn 約5~10分鐘',NULL,'[{"name":"ENEOS Dr.Drive 崇元寺店","googleQuery":"https://www.google.com/maps/search/ENEOS+Dr.Drive+%E5%B4%87%E5%85%83%E5%AF%BA%E5%BA%97+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=ENEOS+Dr.Drive+%E5%B4%87%E5%85%83%E5%AF%BA%E5%BA%97+%E9%82%A3%E8%A6%87","lat":26.2277,"lng":127.6818,"geocode_status":"review"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (445,92,4,'16:30','Check in 東橫inn','放好行李後出門逛國際通','ai','東横INN那覇国際通り美栄橋駅','33 157 413*00',3.9,'行李可先寄放櫃台，輕裝逛國際通更方便',NULL,NULL,NULL,'[{"name":"東横INN那覇国際通り美栄橋駅","googleQuery":"https://www.google.com/maps/search/%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","appleQuery":"https://maps.apple.com/?q=%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","mapcode":"33 157 413*00","lat":26.2166,"lng":127.6895,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (446,92,5,'17:00-20:00','國際通散步＋晚餐','國際通逛街購物，邊走邊吃邊買伴手禮','ai','国際通り 那覇',NULL,4.1,'琉球の牛建議提前線上訂位，週六晚間非常搶手',NULL,NULL,NULL,'[{"name":"国際通り 那覇","googleQuery":"https://www.google.com/maps/search/%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","lat":26.2164,"lng":127.6841,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (447,93,0,'08:30','退房＋寄放行李','東橫inn 退房，將行李寄放櫃台（免費），輕裝出發','ai','東横INN那覇国際通り美栄橋駅','33 157 413*00',3.9,NULL,'train','單軌 美榮橋→首里站 約18分鐘 ¥300（ 建議購買一日券 ¥800）',18,'[{"name":"東横INN那覇国際通り美栄橋駅","googleQuery":"https://www.google.com/maps/search/%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","appleQuery":"https://maps.apple.com/?q=%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","mapcode":"33 157 413*00","lat":26.2166,"lng":127.6895,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (448,93,1,'09:00-10:30','首里城公園','琉球王國的象徵，世界遺產。2019 年大火後正殿重建中（預計 2026 年完工），御庭＋城牆＋守禮門可參觀','ai','首里城公園','33 161 526*00',4.2,'早上光線最適合拍守禮門，西台展望台可看那霸市全景','train','首里→牧志站 約15分鐘 ¥260',15,'[{"name":"首里城公園","googleQuery":"https://www.google.com/maps/search/%E9%A6%96%E9%87%8C%E5%9F%8E%E5%85%AC%E5%9C%92","appleQuery":"https://maps.apple.com/?q=%E9%A6%96%E9%87%8C%E5%9F%8E%E5%85%AC%E5%9C%92","mapcode":"33 161 526*00","lat":26.2172,"lng":127.7193,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (449,93,2,'11:00-12:30','國際通逛街＋買伴手禮','沖繩最熱鬧的商店街，約 1.6 公里。最後衝刺採購伴手禮！','ai','国際通り 那覇','33 157 382*00',4.1,'週日 12:00-18:00 國際通封街成步行者天國，逛起來更舒服',NULL,NULL,NULL,'[{"name":"国際通り 那覇","googleQuery":"https://www.google.com/maps/search/%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","mapcode":"33 157 382*00","lat":26.2164,"lng":127.6841,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (450,93,3,'12:30-14:00','國際通午餐','最後一餐沖繩美食！','ai','国際通り 那覇',NULL,4.1,'やっぱりステーキ CP 值最高午餐選擇；花笠食堂大份量定食在地人也愛吃','walking','步行回美榮橋飯店 約5分鐘',5,'[{"name":"国際通り 那覇","googleQuery":"https://www.google.com/maps/search/%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A+%E9%82%A3%E8%A6%87","lat":26.2164,"lng":127.6841,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (451,93,4,'14:10','回飯店取行李','回東橫inn 領取寄放行李。美榮橋周邊散步、國際通最後採購，或找間咖啡廳休息','ai','東横INN那覇国際通り美栄橋駅','33 157 413*00',3.9,NULL,'train','美榮橋→那霸空港站 約12分鐘 ¥270',12,'[{"name":"東横INN那覇国際通り美栄橋駅","googleQuery":"https://www.google.com/maps/search/%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","appleQuery":"https://maps.apple.com/?q=%E6%9D%B1%E6%A8%AAINN%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A%E7%BE%8E%E6%A0%84%E6%A9%8B%E9%A7%85","mapcode":"33 157 413*00","lat":26.2166,"lng":127.6895,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (452,93,5,'17:15','抵達那霸機場','提早到機場辦理報到＋託運行李。機場免稅店最後衝刺！國內線 2F 有 Blue Seal 冰淇淋，推薦紅芋口味','ai','那霸機場','33 002 519*00',3.9,'國際線免稅店不大，建議在國內線 2F 先買完伴手禮再過去。機場還能買到：⑥Royce鹽巧克力洋芋片⭐5、⑧砂糖樹夾心餅乾⭐4.5、⑨南風堂辣味蝦餅⭐5',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","mapcode":"33 002 519*00","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (453,93,6,'18:00','機場晚餐','在那霸機場國內線 3F 美食街用晚餐','ai','那霸機場',NULL,3.9,'空港食堂在國內線 1F，價格實惠份量足，空港職員也常來吃',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (454,93,7,'20:55','CI 121 起飛回台灣',NULL,'ai','那霸機場','33 002 519*00',3.9,'21:30 抵達桃園｜めんそーれ（歡迎再來）沖繩！',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","mapcode":"33 002 519*00","lat":26.1958,"lng":127.646,"geocode_status":"ok"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (455,94,0,'15:20','MM926 台北出發','桃園國際機場出發，飛往沖繩那霸','ai','桃園國際機場',NULL,4,'建議提前2小時到桃園機場，樂桃航空在第一航廈',NULL,NULL,NULL,'[{"name":"桃園國際機場","googleQuery":"https://www.google.com/maps/search/%E6%A1%83%E5%9C%92%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E6%A1%83%E5%9C%92%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (456,94,1,'17:50-18:30','抵達那霸機場','入境、領取行李、辦理入境手續','user','那霸機場',NULL,3.9,NULL,'train','單軌電車 那霸空港→旭橋 約5分鐘 ¥230',5,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (457,94,2,'18:30-19:00','Check in Living Inn 旭橋駅前','放置行李，休息整理','ai','Living Inn 旭橋駅前',NULL,3.8,'旭橋站直結不用淋雨，附近辻スーパー可買宵夜飲料',NULL,NULL,NULL,'[{"name":"Living Inn 旭橋駅前","googleQuery":"https://www.google.com/maps/search/Living+Inn+%E6%97%AD%E6%A9%8B%E9%A7%85%E5%89%8D+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=Living+Inn+%E6%97%AD%E6%A9%8B%E9%A7%85%E5%89%8D+%E9%82%A3%E8%A6%87"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (458,94,3,'19:30-21:00','那霸國際通晚餐','抵達第一晚，前往國際通附近覓食，感受沖繩夜晚氛圍','ai','那霸國際通',NULL,4.1,'平和通、市場本通可挖到在地小店，比主街少觀光客',NULL,NULL,NULL,'[{"name":"那霸國際通","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (459,95,0,'07:30-08:00','前往集合地點','步行或搭單軌電車前往縣民廣場（沖縄県庁前）','user','沖縄県庁前（縣民廣場）',NULL,4.1,NULL,'train','單軌電車 旭橋→縣廳前 約3分鐘 ¥230',3,'[{"name":"沖縄県庁前（縣民廣場）","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E7%9C%8C%E5%BA%81%E5%89%8D+Izumizaki+1-2-3+Naha","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E7%9C%8C%E5%BA%81%E5%89%8D+Izumizaki+1-2-3+Naha"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (460,95,1,'08:00-18:15','KKday 沖繩北部一日遊','跟團遊覽沖繩北部精華景點：美麗海水族館、古宇利島、名護鳳梨公園。集合地點：縣民廣場（沖縄県庁前 Naha City Izumizaki 1-2-3）','ai','沖縄県庁前（縣民廣場）',NULL,4.5,'車上有中文導遊，建議帶水和輕食；水族館停留時間約2小時要把握',NULL,NULL,NULL,'[{"label":"集合地點","name":"沖縄県庁前（縣民廣場）","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E7%9C%8C%E5%BA%81%E5%89%8D+Naha+City+Izumizaki","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E7%9C%8C%E5%BA%81%E5%89%8D+Naha+City+Izumizaki"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (461,95,2,'12:00-13:00','午餐（團體行程已含）','一日遊行程中包含午餐時間，由導遊安排','ai','沖繩北部',NULL,4.5,'團體行程含午餐，由導遊統一安排用餐地點',NULL,NULL,NULL,'[{"name":"沖繩北部","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E5%8C%97%E9%83%A8","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E5%8C%97%E9%83%A8"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (462,95,3,'18:15-19:45','返回那霸，晚餐','一日遊結束，返回那霸市區享用晚餐','ai','那霸市區',NULL,4,'一日遊回來會比較累，建議選不用排隊的餐廳',NULL,NULL,NULL,'[{"name":"那霸市區","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%B8%82+%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%B8%82+%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (463,96,0,'上午','自由活動（12:30 集合前）','上午時段自由活動，可前往國際通、第一牧志公設市場或旭橋附近咖啡廳休閒。詳見 suggestions 建議。','ai','第一牧志公設市場',NULL,4.2,'牧志市場二樓可代客料理一樓買的海鮮，很適合當早午餐',NULL,NULL,NULL,'[{"name":"第一牧志公設市場","googleQuery":"https://www.google.com/maps/search/%E7%AC%AC%E4%B8%80%E7%89%A7%E5%BF%97%E5%85%AC%E8%A8%AD%E5%B8%82%E5%A0%B4+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=%E7%AC%AC%E4%B8%80%E7%89%A7%E5%BF%97%E5%85%AC%E8%A8%AD%E5%B8%82%E5%A0%B4+%E9%82%A3%E8%A6%87"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (464,96,1,'12:00-12:30','前往集合地點','步行或搭單軌電車前往 Blue Seal Palette 久茂地店（縣廳前站走路4分鐘）','user','Blue Seal Palette 久茂地店',NULL,4.1,NULL,'train','單軌電車 旭橋→縣廳前 約3分鐘 ¥230',3,'[{"name":"Blue Seal Palette 久茂地店","googleQuery":"https://www.google.com/maps/search/Blue+Seal+Palette+%E4%B9%85%E8%8C%82%E5%9C%B0+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=Blue+Seal+Palette+%E4%B9%85%E8%8C%82%E5%9C%B0+%E9%82%A3%E8%A6%87"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (465,96,2,'12:30-21:30','Klook 沖繩西海岸一日遊','跟團遊覽沖繩西海岸精華景點：波上宮、殘波岬燈塔、美國村、東南植物樂園燈光秀。集合地點：Blue Seal Palette 久茂地店（沖縄県那覇市久茂地1丁目1番1号）','ai','Blue Seal Palette 久茂地店',NULL,4.4,'行程含夜間燈光秀，回程較晚；美國村有自由活動時間可逛街購物',NULL,NULL,NULL,'[{"label":"集合地點","name":"Blue Seal Palette 久茂地店","googleQuery":"https://www.google.com/maps/search/Blue+Seal+Palette+%E4%B9%85%E8%8C%82%E5%9C%B01%E4%B8%81%E7%9B%AE+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=Blue+Seal+Palette+%E4%B9%85%E8%8C%82%E5%9C%B01%E4%B8%81%E7%9B%AE+%E9%82%A3%E8%A6%87"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (466,96,3,'13:00-14:00','午餐（團體行程已含）','一日遊行程中包含午餐時間，由導遊安排','ai','沖繩西海岸',NULL,4.4,'團體行程含午餐，由導遊統一安排用餐地點',NULL,NULL,NULL,'[{"name":"沖繩西海岸","googleQuery":"https://www.google.com/maps/search/%E6%B2%96%E7%B8%84%E8%A5%BF%E6%B5%B7%E5%B2%B8","appleQuery":"https://maps.apple.com/?q=%E6%B2%96%E7%B8%84%E8%A5%BF%E6%B5%B7%E5%B2%B8"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (467,96,4,'21:30-23:00','返回那霸，晚餐','一日遊結束返回那霸市區，選擇深夜營業的餐廳用餐','ai','那霸市區',NULL,4,'回來已經九點半，選深夜營業的店最保險',NULL,NULL,NULL,'[{"name":"那霸市區","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%B8%82+%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%B8%82+%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (468,97,0,'10:00前','退房 Living Inn，行李寄放','10點前退房 Living Inn 旭橋駅前，前往 THE NEST NAHA 辦理行李寄放（Check in 時間未到，先寄放再出發）','ai','Living Inn 旭橋駅前',NULL,3.8,NULL,'bus','步行或計程車 約10分鐘（Living Inn → 那霸巴士總站）',10,'[{"label":"退房","name":"Living Inn 旭橋駅前","googleQuery":"https://www.google.com/maps/search/Living+Inn+%E6%97%AD%E6%A9%8B%E9%A7%85%E5%89%8D+%E9%82%A3%E8%A6%87","appleQuery":"https://maps.apple.com/?q=Living+Inn+%E6%97%AD%E6%A9%8B%E9%A7%85%E5%89%8D+%E9%82%A3%E8%A6%87"},{"label":"新飯店","name":"THE NEST NAHA","googleQuery":"https://www.google.com/maps/search/THE+NEST+NAHA+Nishi+Naha","appleQuery":"https://maps.apple.com/?q=THE+NEST+NAHA+Nishi+Naha"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (469,97,1,'10:30-11:30','搭巴士前往 AEON Mall 來客夢','那霸巴士總站搭 21 或 92 號公車前往永旺夢樂城（AEON Mall Okinawa Rycom），車程約60分鐘','ai','那霸巴士總站',NULL,3.8,NULL,'bus','巴士 21 或 92 號 那霸バスターミナル→ライカム 約60分鐘',60,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (470,97,2,'11:30-18:30','AEON Mall 來客夢購物','沖繩最大購物中心！日本最大級 AEON Mall，各大品牌、美食街、超市、藥妝一次滿足','ai','AEON Mall Okinawa Rycom',NULL,4.2,'超市在一樓最裡面，建議留最後再買冷藏伴手禮；免稅櫃台在一樓服務台',NULL,NULL,NULL,'[{"name":"AEON Mall Okinawa Rycom","googleQuery":"https://www.google.com/maps/search/AEON+Mall+Okinawa+Rycom+%E5%8C%97%E4%B8%AD%E5%9F%8E","appleQuery":"https://maps.apple.com/?q=AEON+Mall+Okinawa+Rycom+%E5%8C%97%E4%B8%AD%E5%9F%8E"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (471,97,3,'19:00前','搭巴士返回那霸','19:00 前出發搭巴士返回那霸，Check in THE NEST NAHA','ai','那霸巴士總站',NULL,3.8,NULL,'bus','巴士 21 或 92 號 ライカム→那霸バスターミナル 約60分鐘',60,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (472,97,4,'18:30-20:00','晚餐',NULL,'ai','那霸國際通周邊',NULL,4,'搬完行李到新飯店後就近覓食，旭橋周邊選擇也不少',NULL,NULL,NULL,'[{"name":"那霸國際通周邊","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (473,97,5,'20:00-20:30','Check in THE NEST NAHA','辦理 Check in，放置行李。可使用 14F 溫水游泳池（9:00~22:00）','ai','THE NEST NAHA',NULL,4.2,'14F 泳池開到22:00，放完行李還來得及游一下',NULL,NULL,NULL,'[{"name":"THE NEST NAHA","googleQuery":"https://www.google.com/maps/search/THE+NEST+NAHA+Nishi+Naha","appleQuery":"https://maps.apple.com/?q=THE+NEST+NAHA+Nishi+Naha"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (474,98,0,'上午','飯店早晨・出發準備','在飯店享用早晨時光，可使用 14F 溫水游泳池（9:00~22:00）','ai','THE NEST NAHA',NULL,4.2,'最後一晚住這裡，早上可悠閒享用早餐和泳池設施',NULL,NULL,NULL,'[{"name":"THE NEST NAHA","googleQuery":"https://www.google.com/maps/search/THE+NEST+NAHA+Nishi+Naha","appleQuery":"https://maps.apple.com/?q=THE+NEST+NAHA+Nishi+Naha"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (475,98,1,'10:00-10:30','搭巴士前往 iias 沖繩豐崎','那霸巴士總站搭 98、55 或 56 號巴士，至「豐崎美麗陽光海灘前站」下車','ai','那霸巴士總站',NULL,3.8,NULL,'bus','巴士 98/55/56 號 那霸→豐崎美麗陽光海灘前站 約30分鐘',30,'[{"name":"那霸巴士總站","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E3%83%90%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%9F%E3%83%8A%E3%83%AB"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (476,98,2,'10:30-18:00','iias 沖繩豐崎購物','面海的開放式購物中心，戶外廣場可遠眺海景。多家品牌店鋪、美食餐廳，鄰近豐崎美麗陽光海灘','ai','iias 沖繩豐崎',NULL,4,'天氣好的話可到旁邊豐崎海灘走走，戶外廣場海景很美；伴手禮最後在這裡買齊',NULL,NULL,NULL,'[{"name":"iias 沖繩豐崎","googleQuery":"https://www.google.com/maps/search/iias%E6%B2%96%E7%B8%84%E8%B1%8A%E5%B4%8E+3-35+Toyosaki+Tomigusuku","appleQuery":"https://maps.apple.com/?q=iias%E6%B2%96%E7%B8%84%E8%B1%8A%E5%B4%8E+Toyosaki+Tomigusuku"},{"label":"附近海灘","name":"豐崎美麗陽光海灘","googleQuery":"https://www.google.com/maps/search/%E8%B1%8A%E5%B4%8E%E7%BE%8E%E3%82%89SUN%E3%83%93%E3%83%BC%E3%83%81+%E8%B1%8A%E8%A6%8B%E5%9F%8E","appleQuery":"https://maps.apple.com/?q=%E8%B1%8A%E5%B4%8E%E7%BE%8E%E3%82%89SUN%E3%83%93%E3%83%BC%E3%83%81+%E8%B1%8A%E8%A6%8B%E5%9F%8E"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (477,98,3,'18:00-19:30','搭巴士返回那霸晚餐','返回那霸市區享用最後一夜晚餐，可至國際通或旭橋周邊','user','那霸國際通周邊',NULL,4,'最後一晚晚餐，推薦吃沖繩在地料理做個完美收尾','bus','巴士 98/55/56 號 豐崎→那霸 約30分鐘',30,'[{"name":"那霸國際通周邊","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E8%A6%87%E5%9B%BD%E9%9A%9B%E9%80%9A%E3%82%8A"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (478,99,0,'09:00-09:30','退房 THE NEST NAHA','整理行李退房，前往那霸機場','user','THE NEST NAHA',NULL,4.2,NULL,'train','單軌電車 旭橋→那霸空港 約12分鐘 ¥270',12,'[{"name":"THE NEST NAHA","googleQuery":"https://www.google.com/maps/search/THE+NEST+NAHA+Nishi+Naha","appleQuery":"https://maps.apple.com/?q=THE+NEST+NAHA+Nishi+Naha"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (479,99,1,'10:00-10:30','抵達那霸機場・辦理報到','提早到機場辦理報到、託運行李。機場免稅店最後採購！Blue Seal 冰淇淋推薦紅芋口味','ai','那霸機場',NULL,3.9,'國內線二樓免稅店最齊全，御果子御殿和 Blue Seal 都有；建議預留30分鐘逛',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (480,99,2,'10:30-11:35','機場午餐','在那霸機場國內線出發大廳用餐','ai','那霸機場',NULL,3.9,'空港食堂在一樓角落不顯眼但CP值最高，建議11點前去避開排隊',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (481,99,3,'11:35','MM925 沖繩起飛','搭乘樂桃航空 MM925 返回台灣桃園','ai','那霸機場',NULL,3.9,'樂桃手提行李限7公斤，超重需提前加購託運額度',NULL,NULL,NULL,'[{"name":"那霸機場","googleQuery":"https://www.google.com/maps/search/%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E9%82%A3%E9%9C%B8%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (482,99,4,'14:20','抵達桃園國際機場','めんそーれ（歡迎再來）沖繩！祝旅途愉快！','ai','桃園國際機場',NULL,4,'入境後可搭機捷回市區，桃園機場第一航廈直達',NULL,NULL,NULL,'[{"name":"桃園國際機場","googleQuery":"https://www.google.com/maps/search/%E6%A1%83%E5%9C%92%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4","appleQuery":"https://maps.apple.com/?q=%E6%A1%83%E5%9C%92%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4"}]');
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (721,84,0,'08:00','BUZZ RESORT 出發',NULL,'ai','Buzz Resort Chatan',NULL,4.3,'浮潛集合時間 08:30，建議提早出發預留找路時間','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (722,84,1,'08:15-10:45','前兼久漁港（青之洞浮潛集合點）','青之洞浮潛體驗（船潛）— 集合到解散約 2.5 小時','ai','前兼久漁港',NULL,4,'**2026 青之洞浮潛體驗（船潛）**

- 每位 ¥8,500（2人以上同行 ¥7,900，7天前預訂優惠價）
- 大小同價，無年齡限制，中文教練，2人以上私人小組

**活動時間**：8:30 / 10:30 / 12:30 / 14:30（集合時間提早15分鐘報到）

**所需時間**：約2.5小時（集合到解散）

**費用包含**：浮潛指導、潛點導覽、浮潛裝備、餵魚飼料、船資、拍照、保險

**自備物品**：泳裝（穿好）、毛巾、換洗衣物、拖鞋、隱形眼鏡

**注意事項**：
- 導航：電話 098-965-2452 / Mapcode 206 096 016
- 來時泳裝穿在衣服裡面
- 近視者可用免費有度數面鏡（300°~900°），預約時告知
- 容易暈船請自備暈船藥
- 下雨照常，海況不佳可能改地點或取消（全額退費）','car','約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (723,84,2,'11:10-12:10','殘波岬公園','残波岬公園 — 壯觀海岸線、燈塔','ai','残波岬公園',NULL,4.3,'燈塔可付費登頂（200日圓），崖邊風大注意安全，停車場免費','car','約20分鐘',20,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (724,84,3,'12:15-13:00','午餐（読谷村）','殘波岬附近午餐 — 読谷村在地美食','ai','花織そば 読谷村',NULL,4.1,'花織そば 售完即止，建議 11 點半前抵達較保險','car','約20分鐘',20,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (725,84,4,'13:20-13:50','萬座毛','万座毛 — 象鼻岩自然景觀（約30分鐘）','ai','万座毛',NULL,4.2,'入場費 100 日圓，步道約 20 分鐘走完，午後逆光較難拍照建議上午來','car','約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (726,84,5,'14:15-15:15','業務超市 宇流麻石川店','業務スーパー うるま石川店 — 食材採買（VILLA 自炊用）','ai','業務スーパー うるま石川店',NULL,3.8,'業務超市以大份量食材為主，適合 Villa 自炊採買，冷凍肉品和調味料CP值高','car','約20分鐘',20,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (727,84,6,'15:35-16:05','HOPE VILLA Onnason','HOPE VILLA Onnason（恩納村）— Check in','ai','HOPE VILLA Onnason',NULL,4.5,'Villa 有廚房可自炊，入住後確認設備與備品','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (728,84,7,'16:25-17:10','BIG1 採買','ザ・ビッグ（AEON 系列折扣超市）— 零食、飲料、日用品採買','ai','ザ・ビッグ エクスプレス 石川店',NULL,3.6,'AEON 系列折扣超市，適合採購零食飲料與日用品','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (729,84,8,'17:20','VILLA 自由活動','Check in 後自由休息（VILLA 自炊或外食）','ai','HOPE VILLA Onnason',NULL,4.5,'可用業務超市買的食材自炊，或參考晚餐替代方案外食','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (730,82,0,'16:30-18:30','桃園國際機場 出發','虎航 IT232，辦理登機、出境','ai','桃園國際機場',NULL,4.2,NULL,'flight','飛行 約1小時20分',NULL,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (731,82,1,'20:50-21:50','抵達那霸機場','入境、領取行李','ai','那霸機場',NULL,4,'出機場後搭ゆいレール（沖繩單軌電車），那覇空港駅→壺川駅約12分鐘（260日圓），出站步行約5分鐘到飯店。7人可買一日券（800日圓）更划算','train','ゆいレール 那覇空港駅→壺川駅 約12分＋步行5分',17,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (732,82,2,'22:07','沖繩那霸美居飯店 Check in','Mercure Okinawa Naha','ai','メルキュール沖縄那覇',NULL,4,'深夜入住，建議事先確認自助 Check in 流程',NULL,NULL,NULL,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (733,83,0,'09:00','沖繩那霸美居飯店 出發','退房後在飯店取車出發｜7座車 Toyota Alphard｜4大3小（14、15、10歲）

**出發前早餐推薦**：壺川／牧志周邊，步行或短程車程可達','ai','メルキュール沖縄那覇',NULL,4,'沖繩旅毛會將車開到飯店交車，取車時攜帶護照與台灣駕照日文譯本，確認車況並拍照存證',NULL,NULL,NULL,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (734,83,1,'09:07-10:07','天久琉貿樂市','天久りうぼう — 超市採買','ai','天久りうぼう楽市',NULL,3.9,'在地人常去的複合型超市，價格比觀光區便宜，適合第一天大量採買。必買伴手禮：③沖繩黑糖夏威夷豆巧克力⭐5、⑥Royce鹽巧克力洋芋片⭐5、⑨南風堂辣味蝦餅⭐5','car','約7分鐘',7,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (735,83,2,'10:22-11:22','浦添大公園','長溜滑梯等設施，適合親子','ai','浦添大公園',NULL,4.1,'超長滾輪溜滑梯小孩超愛，建議穿長褲或墊紙板避免摩擦燙屁股','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (736,83,3,'11:42-12:42','午餐',NULL,'ai','サンエー浦添西海岸パルコシティ',NULL,4.2,'PARCO CITY 3F 美食街選擇多，週末午餐尖峰時段建議避開 12:00~13:00','car','約20分鐘',20,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (737,83,4,'12:42-15:42','PARCO CITY 購物','グラニフ 沖縄 PARCO CITY 等店家逛街購物','ai','サンエー浦添西海岸パルコシティ',NULL,4.2,'沖繩最大購物中心，有海景露台可休息，免稅櫃台在 1F 服務中心旁。必買伴手禮：⑧砂糖樹夾心餅乾⭐4.5、⑩HORINISHI萬能調味粉⭐4.5','walk','同商場',0,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (738,83,5,'16:06-17:06','晚餐','美國村周邊晚餐','ai','美浜アメリカンビレッジ',NULL,4.1,'迴轉壽司排隊人多，建議先去抽號碼牌再逛美國村

**備案餐廳**：Plate Jam — 美國村內網美風咖啡餐廳，漢堡排與鬆餅人氣高，適合親子用餐','car','約24分鐘',24,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (739,83,6,'17:06-20:06','美國村','アメリカンビレッジ — 異國風情商圈、逛街購物、夜景','ai','美浜アメリカンビレッジ',NULL,4.2,'夜景拍照最佳時間為日落後30分鐘，摩天輪旁的彩色牆面是打卡熱點','walk','同商圈',0,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (740,83,7,'20:11','BUZZ RESORT Check in','Design Resort Nakadoma inn — 北谷町住宿','ai','Buzz Resort Chatan',NULL,4.3,'深夜入住請降低音量，事先確認自助入住方式','car','約5分鐘',5,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (741,85,0,'09:00','HOPE VILLA Onnason 出發','**出發前早餐推薦**：恩納周邊或前往名護順路的早餐選擇','ai','HOPE VILLA Onnason',NULL,4.5,'今天行程往北較遠，建議準時出發','car','約26分鐘',26,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (742,85,1,'09:26-11:26','名護鳳梨園','ナゴパイナップルパーク — 鳳梨主題園區、試吃區（約2小時）','ai','ナゴパイナップルパーク',NULL,3.9,'園內自動導覽車適合小孩，試吃區鳳梨酒和鳳梨蛋糕可免費品嘗','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (743,85,2,'11:36-12:36','午餐',NULL,'ai','百年古家 大家',NULL,4.1,'百年古家大家週末常排隊，建議網路訂位；庭園瀑布景觀座位氣氛佳','car','約26分鐘',26,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (744,85,3,'13:02-15:28','沖繩美麗海水族館','沖縄美ら海水族館 — 入場後先預約 Ocean Blue Cafe，13:00 看海豚秀（從水族館出口徒步約5分鐘，遊園車於「3.海豚劇場」下車），再返回館內參觀，15:00 看黑潮之海餵食秀。【黑潮之海】9:30（鬼蝠魟攝食）／15:00・17:00（鯨鯊垂直站立餵食）【海豚秀】10:30／11:30／13:00／15:00／17:00','ai','沖縄美ら海水族館',NULL,4.6,'16:00 後入場門票半價；停車場免費但暑假要到，建議停 P7 離入口最近。出口禮品店必買伴手禮：⑤紅芋脆餅（美麗海水族館版）⭐4','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (745,85,4,'15:38-16:08','Shinmei Coffee','THE Sinmay — 今帰仁村人氣小木屋咖啡站，招牌現刨生黑糖拿鐵，店員現場刨黑糖灑在拿鐵上超療癒（約30分鐘）','ai','THE Sinmay 今帰仁',NULL,4.3,'10:00~16:30 營業，僅收現金或電子支付（不收信用卡）；附免費停車場','car','約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (746,85,5,'16:33-17:03','古宇利海洋塔','古宇利オーシャンタワー — 觀景塔、眺望古宇利大橋（約30分鐘）','ai','古宇利オーシャンタワー',NULL,3.9,'自動導覽車上山，頂樓觀景台可 360 度眺望古宇利大橋與海景','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (747,85,6,'17:06-19:06','古宇利島','古宇利島 — 環島兜風、沙灘散步（約2小時）','ai','古宇利島',NULL,4.4,'心型岩在島北側 Tinu 海灘，環島一圈約 20 分鐘車程，夕陽時分大橋上拍照絕美','car','約5分鐘',5,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (748,85,7,'19:35-20:35','晚餐',NULL,'ai','島豚七輪焼 満味 名護',NULL,4.3,'滿味非常熱門，建議提前預約或 17:00 開門前排隊，有中文菜單','car','約28分鐘',28,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (749,85,8,'21:03','HOPE VILLA Onnason','返回住宿休息','ai','HOPE VILLA Onnason',NULL,4.5,'回程走高速較快，Villa 連住免搬行李','car','約28分鐘',28,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (750,86,0,'09:00','HOPE VILLA Onnason 出發','**出發前早餐推薦**：恩納周邊的早餐選擇（與 Day 4 不同推薦）','ai','HOPE VILLA Onnason',NULL,4.5,'退房前確認 Villa 內無遺留物品，行李全部上車','car','約12分鐘',12,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (751,86,1,'09:12-10:12','Ryukyu Beach Club','海灘活動','ai','Ryukyu Beach Club',NULL,4.3,'恩納村私人海灘，水質清澈適合小孩玩水，建議自備浮潛裝備','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (752,86,2,'10:48-12:30','永旺夢樂城沖繩來客夢','イオンモール沖縄ライカム — 大型購物中心（約3小時）','ai','イオンモール沖縄ライカム',NULL,4.2,'沖繩最大AEON，1F 超市可買伴手禮，頂樓停車場有免費充電樁。AEON STYLE 必買伴手禮：③沖繩黑糖夏威夷豆巧克力⭐5、⑥Royce鹽巧克力洋芋片⭐5、⑦沖繩褐藻&苦瓜香鬆⭐4、⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5','car','約30分鐘',30,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (753,86,3,'12:30-13:30','來客夢午餐','在來客夢 3F 美食街用午餐','ai','イオンモール沖縄ライカム',NULL,4.2,'3F 美食街週末人多，建議避開 12:00 尖峰或改去 1F 超市熟食區','walk','同商場',NULL,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (754,86,4,'13:30-14:30','沖繩寶可夢中心','ポケモンセンターオキナワ — 來客夢1F','ai','イオンモール沖縄ライカム',NULL,4.2,'沖繩限定皮卡丘商品很搶手，週末可能需排隊入場，小孩會逛很久','walk','同商場',0,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (755,86,5,'15:25-17:55','國際通商店街','那覇国際通り — 逛街購物（約2.5小時）','ai','国際通り 那覇',NULL,4.1,'路邊停車不易，建議停「てんぶす那覇」地下停車場；伴手禮可比價，巷弄內比大街便宜','car','約30分鐘',30,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (756,86,6,'18:01-19:01','晚餐','','ai','国際通り 那覇',NULL,4.1,'花笠食堂週日公休，もとぶ牧場建議提前網路訂位','walk','步行約5分鐘',5,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (757,86,7,'19:11-20:11','San-A Naha Main Place','サンエー那覇メインプレイス — 購物中心','ai','サンエー那覇メインプレイス',NULL,4,'在地人的購物中心，1F超市生鮮熟食品質好，冷氣強建議帶薄外套','car','約4分鐘',4,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (758,86,8,'20:15-20:45','タウンプラザかねひで 壺川店','在地超市最終補貨，價格比觀光區便宜','ai','タウンプラザかねひで 壺川店',NULL,3.7,'壺川站旁，離那霸美居飯店車程約5分鐘','car','約5分鐘',5,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (759,86,9,'20:50','沖繩那霸美居飯店 Check in','先到**タウンプラザかねひで 壺川店**採買（飯店旁步行3分鐘，09:00~23:00），再回飯店整理行李','ai','メルキュール沖縄那覇',NULL,4,'在地超市價格實惠，可買沖繩縣產豬肉生鮮、島豆腐、沖繩泡盛','walk','步行約1分鐘',1,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (760,87,0,'09:00','沖繩那霸美居飯店 出發','**出發前早餐推薦**：壺川／那覇周邊（與 Day 2 不同推薦或再訪喜歡的店）','ai','メルキュール沖縄那覇',NULL,4,'今天要還車，大型行李可先寄放飯店','car','約7分鐘',7,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (761,87,1,'09:07-10:37','第一牧志公設市場','沖繩人的廚房！1樓鮮魚海產攤位選購食材，2樓代客料理（3樣500日圓）；必吃夜光貝、石垣牛握壽司、步沙翁（約1.5小時）','ai','第一牧志公設市場',NULL,4.2,'1F 海鮮攤可殺價，2F 代煮料理費另計；建議 10 點開門就到比較從容','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (762,87,2,'10:47-11:47','沖繩媳婦 okinawa shinboo','台灣媳婦經營的超人氣伴手禮店，中文溝通零障礙！必買花生豆腐、黑糖、香檸、雪鹽金楚糕、天使之羽、石垣島辣油、宮古牛洋芋片，價格實惠品質保證','ai','沖縄嫁 okinawa shinboo 那覇曙',NULL,4.5,'營業時間 10:30~14:30，台灣媳婦親切中文服務，會細心提醒哪些能帶上飛機。必買伴手禮：①花生豆腐⭐5、②黑糖⭐4.5、③石垣島辣油⭐5、④宮古牛洋芋片⭐4.5','car','約25分鐘',25,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (763,87,3,'12:12-13:12','午餐','前往玉泉洞途中的人氣海景咖啡廳，居高臨下眺望太平洋。招牌泰式綠咖哩與南洋料理風味獨特，搭配無敵海景用餐體驗極佳','ai','カフェくるくま 南城',NULL,4.1,'先吃飽再逛玉泉洞，海景咖啡搭配南洋料理','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (764,87,4,'13:22-14:22','玉泉洞','全長5公里鐘乳石洞穴（開放800m，步行約40分鐘）；必看百萬支石筍燈光造景、王國村琉球工藝體驗、SUPER EISA太鼓秀（10:30/12:30/14:30）','ai','おきなわワールド',NULL,4.1,'洞內涼爽約 21°C 但濕度高，地面濕滑注意防滑；EISA太鼓秀 14:30 場次可順路看','car','約30分鐘',30,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (765,87,5,'14:52-15:22','波上宮','沖繩八社之首，崖上絕美神社；必看紅型圖案御守（800~1200日圓）、貝殼良緣御守、波之上海灘絕景拍照點（後方臨港道路）','ai','波上宮',NULL,4.3,'免費參拜，旁邊波之上海灘可順遊
**拍照提醒**：走「波之上臨海道路」（大橋），從橋上往回看，才能拍到波上宮蓋在懸崖上的震撼全景喔！','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (766,87,6,'15:37-17:37','瀨長島','沖繩小希臘白色露台商場；必吃幸福鬆餅（建議提前2週訂位）、氾濫漢堡、47Store冰淇淋；必看子寶岩打卡點、夕陽海景、飛機起降（約2小時）','ai','瀬長島ウミカジテラス',NULL,4.1,'傍晚來最美，可同時看夕陽和飛機起降；幸福鬆餅需提前 2 週網路訂位','car','約10分鐘',10,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (767,87,7,'17:47-18:02','加油站','還車前加滿油。瀨長島往那霸方向的國道 331 沿線有多間加油站，自助式（セルフ）較便宜。**加油步驟**：停車熄火 → 選油種（レギュラー）→ 插入信用卡或投入現金 → 拿油槍加油 → 取收據','ai','ガソリンスタンド 豊見城 セルフ',NULL,3.5,'選「レギュラー」（普通汽油）即可，日本加油多為自助式，操作介面有中文選項','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (768,87,8,'18:17-19:17','晚餐','那霸美居飯店（壺川）附近的晚餐推薦，開車約5~10分鐘即達，最後一晚享受沖繩美食','ai','メルキュール沖縄那覇 周辺 レストラン',NULL,4.1,'飯店附近用餐，晚餐後開車至新都心還車','car','約15分鐘',15,NULL);
INSERT OR IGNORE INTO trip_entries (id,day_id,sort_order,time,title,description,source,maps,mapcode,google_rating,note,travel_type,travel_desc,travel_min,location) VALUES (769,87,9,'19:32-20:02','沖繩旅毛 還車','還車前確認車內無遺留物品，油已加滿。還車後可搭單軌電車（おもろまち駅→壺川駅，約15分鐘 ¥300）或計程車（約10分鐘 ¥1,000）回飯店','ai','沖繩旅毛 那覇新都心',NULL,4.8,'還車後搭單軌電車或計程車回飯店，沖繩旅毛位於新都心おもろまち站附近','car','約15分鐘',15,NULL);

-- restaurants (pre-POI migration)
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (235,190,0,'花月嵐拉麵 板橋府中店','日式拉麵','11:00~21:30','NT$230~350','不需訂位',NULL,'日本直營的京都風拉麵，雞白湯細膩清甜，叉燒入口即化','湯頭偏清淡適合怕油者',3.9,'花月嵐拉麵 板橋府中店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (236,190,1,'薄多義 板橋大遠百店','義大利麵','11:00~21:30','NT$280~500','不需訂位',NULL,'義大利窯烤薄皮披薩名店，Margherita與黑松露口味深受好評','大遠百B1可直接搭電梯',4,'薄多義 板橋大遠百店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (237,190,2,'高記生炒魷魚','特色小吃','08:00~17:30（週一休）','NT$50~100','不需訂位',NULL,'黃石市場 30 年老字號，生炒魷魚羹、蘿蔔糕','週一公休且下午收攤',4.3,'高記生炒魷魚',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (238,192,0,'懸日拉麵','日式拉麵','17:00~22:00','NT$250~380','不需訂位',NULL,'板橋人氣排隊拉麵，獨創水果系拉麵，檸檬雞白湯清爽驚艷','常排隊建議提早到場',4.5,'懸日拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (239,192,1,'擼義晚義大利麵','義大利麵','17:00~21:00','NT$130~260','不需訂位',NULL,'Google 4.9高分，在地人偷藏的高CP值平價義大利麵','僅晚餐時段營業',4.9,'擼義晚義大利麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (240,192,2,'老味噌居酒屋 新埔店','特色小吃','18:00~01:30','NT$300~600','不需訂位',NULL,'新埔站超人氣日式串燒，烤物功夫一流','適合晚餐小酌聚會',4.2,'老味噌居酒屋 新埔店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (241,194,0,'好呷拉麵 板橋三民店','日式拉麵','11:00~21:00','NT$145~250','不需訂位',NULL,'新北最高CP值拉麵，145元起無限續麵及甜點吃到飽','無限續麵CP值極高',4.5,'好呷拉麵 板橋三民店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (242,194,1,'麵食主義 KIRIN PASTA 新板店','義大利麵','11:30~14:00 / 17:00~20:30','NT$99~180','不需訂位',NULL,'板橋最平價義大利麵，百元有找份量十足','分午晚兩時段營業',4.3,'麵食主義 KIRIN PASTA 新板店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (243,194,2,'涓豆腐 環球板橋店','特色小吃','11:00~22:00','NT$250~400','不需訂位',NULL,'韓國豆腐煲專賣，嫩豆腐鍋香濃入味，小菜無限續','小菜吃到飽很划算',4.1,'涓豆腐 環球板橋店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (244,196,0,'双豚拉麵','日式拉麵','11:30~14:00 / 17:00~21:30','NT$220~350','不需訂位',NULL,'板橋拉麵王，鷹流系醬油拉麵，叉燒厚切銷魂，免費續麵一次','免費續麵一次很佛心',4.5,'双豚拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (245,196,1,'Buon Pasta 現代義式料理','義大利麵','11:30~15:30 / 18:00~22:30','NT$350~550','建議訂位',NULL,'澳洲藍帶主廚坐鎮，每日現做八種造型手工義大利麵','建議提前訂位以免向隅',4.3,'Buon Pasta 現代義式料理',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (246,196,2,'饗食天堂 板橋店','特色小吃','11:30~14:00 / 17:30~21:30','NT$800~1200','建議訂位',NULL,'頂級自助百匯，海鮮日料甜點超過200道料理','假日熱門務必預約',4,'饗食天堂 板橋店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (247,198,0,'奧特拉麵 Ramen Ultra','日式拉麵','11:00~21:30','NT$250~380','不需訂位',NULL,'日本秋田縣直營，雞骨湯頭醬油與鹽味拉麵，環球板橋車站內','車站內用餐免淋雨',4.3,'奧特拉麵 Ramen Ultra 環球板橋車站店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (248,198,1,'Pocket Pasta 口袋義大利麵','義大利麵','11:30~14:00 / 17:00~20:30','NT$220~350','不需訂位',NULL,'板新站旁平價義式，多種麵體與口味自由搭配','午晚分兩時段注意休息時間',4.2,'Pocket Pasta 口袋義大利麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (249,198,2,'秋香ㄟ店','特色小吃','11:00~19:00（週一休）','NT$30~80','不需訂位',NULL,'黃石市場飄香近百年老店，古早味油飯、清湯肉羹經典必吃','週一公休且下午易賣完',4,'秋香ㄟ店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (250,201,0,'博多一幸舎 新莊店','日式拉麵','11:00~22:00','NT$250~380','不需訂位',NULL,'福岡豚骨拉麵名店，濃厚博多風白湯，麵條細直可免費加麵','可免費加麵一次',4.1,'博多一幸舎 新莊店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (251,201,1,'歐義式 新莊店','義大利麵','11:00~21:30','NT$220~380','不需訂位',NULL,'新莊義大利麵專門店，現炒義大利麵配自製醬汁，奶油培根與青醬海鮮最受歡迎','奶油培根口味最推薦',3.9,'歐義式 新莊店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (252,201,2,'阿瑞官粿店','特色小吃','06:00~18:00','NT$20~60','不需訂位',NULL,'新莊老街百年粿店，芋粿巧、草仔粿手工現做','下午就打烊建議早去',4.3,'阿瑞官粿店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (253,203,0,'麵屋壹慶 三重店','日式拉麵','11:00~21:00','NT$220~320','不需訂位',NULL,'三重在地日式拉麵，濃郁豚骨湯頭搭配手工麵條，叉燒厚切多汁','叉燒加量很值得',4.2,'麵屋壹慶 三重店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (254,203,1,'小義大利莊園 三重店','義大利麵','11:30~21:00','NT$250~420','建議訂位',NULL,'三重義式餐廳，窯烤披薩與義大利麵雙主打，義式燉飯香氣濃郁','建議訂位以免候位',4,'小義大利莊園 三重店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (255,203,2,'三重鵝肉李','特色小吃','11:00~21:00','NT$100~300','不需訂位',NULL,'三重在地鵝肉名店，鵝肉切盤鮮嫩，鵝肉湯麵經典','現切鵝肉是招牌必點',4.1,'三重鵝肉李',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (256,205,0,'熊越岳','日式拉麵','11:00~14:00 / 17:00~21:00','NT$250~420','不需訂位',NULL,'新莊超人氣排隊拉麵，爆量叉燒醬油拉麵，免費加麵吃到飽','開門前就要排隊',4.6,'熊越岳',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (257,205,1,'義倆義式廚房','義大利麵','11:00~14:00 / 17:00~21:00','NT$180~350','建議訂位',NULL,'新莊棒球場旁平價義大利麵，手工醬汁大份量，紅茶無限暢飲','紅茶無限暢飲很貼心',4.4,'義倆義式廚房',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (258,205,2,'福壽街陽春麵','特色小吃','06:00~14:00','NT$40~80','不需訂位',NULL,'新莊在地30年老麵攤，手打陽春麵Q勁十足','僅午餐時段營業',4,'福壽街陽春麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (259,207,0,'炊煙拉麵','日式拉麵','11:30~14:00 / 17:30~20:00','NT$200~320','不需訂位',NULL,'三重國小站旁人氣拉麵，黑蒜豚骨與雞白湯濃郁鮮美','晚餐時段限定要注意',4.5,'炊煙拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (260,207,1,'Duke''s Pizza 義式薄皮披薩','義大利麵','11:30~14:30 / 17:00~22:00','NT$220~380','不需訂位',NULL,'台北橋站旁義式餐廳，手工薄皮披薩與義大利麵選擇豐富','不需訂位可直接入座',4.4,'Duke''s Pizza 義式薄皮披薩',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (261,207,2,'新莊牛肉麵大王','特色小吃','11:00~21:00','NT$120~200','不需訂位',NULL,'紅燒牛肉麵湯頭濃醇，牛肉塊大又軟嫩','牛肉塊大份量十足',4.1,'新莊牛肉麵大王',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (262,209,0,'赤初中華拉麵 新莊店','日式拉麵','11:30~14:30 / 17:00~22:00','NT$260~380','不需訂位',NULL,'小菜放題吃到飽，八大功夫湯料多實在，高CP值拉麵','小菜放題吃到飽超划算',4.4,'赤初中華拉麵 新莊店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (263,209,1,'福F Pasta','義大利麵','11:30~14:00 / 17:00~21:00','NT$180~300','不需訂位',NULL,'新莊副都心巷弄愛店，現點現做義大利麵用料實在','巷弄內注意導航',4.7,'福F Pasta',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (264,209,2,'今大魯肉飯','特色小吃','07:00~20:00','NT$30~80','不需訂位',NULL,'三重排隊名店，肥瘦比例完美的魯肉飯，加顆滷蛋絕配','排隊名店建議避開尖峰',4.3,'今大魯肉飯',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (265,211,0,'丸宗拉麵屋','日式拉麵','11:30~14:00 / 17:00~21:00','NT$180~300','不需訂位',NULL,'全雞入湯的雞白湯拉麵，湯頭濃郁層次豐富','雞白湯口味清爽不膩',4.3,'丸宗拉麵屋',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (266,211,1,'巧巧義麵屋','義大利麵','17:00~21:30','NT$150~250','不需訂位',NULL,'三重國小站旁在地人愛店，紅茶與濃湯免費無限暢飲','僅晚餐時段營業',4.6,'巧巧義麵屋',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (267,211,2,'正羊肉榮 三重店','特色小吃','16:00~01:00','NT$300~600','不需訂位',NULL,'三重人氣羊肉爐，藥膳湯底溫潤，帶皮羊肉軟嫩不騷','建議訂位避免久候',4.2,'正羊肉榮 三重店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (268,213,0,'豚骨拉麵ばかうまラーメン 永和店','日式拉麵','11:30~21:30','NT$240~360','不需訂位',NULL,'永和人氣拉麵，豚骨高湯熬煮12小時，濃厚乳白湯底配軟嫩叉燒','湯頭濃厚偏重口味',4,'豚骨拉麵ばかうまラーメン 永和店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (269,213,1,'藍乳酪義大利餐廳','義大利麵','11:30~21:30','NT$250~450','建議訂位',NULL,'永和人氣義式餐廳，手工窯烤披薩與義大利麵','建議訂位以免候位',4.1,'藍乳酪義大利餐廳',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (270,213,2,'世界豆漿大王','特色小吃','24小時營業','NT$30~80','不需訂位',NULL,'永和豆漿創始店之一，鹹豆漿、燒餅油條經典組合','24小時營業隨時可去',4,'世界豆漿大王',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (271,215,0,'山頭火拉麵 中和環球店','日式拉麵','11:00~21:30','NT$250~380','不需訂位',NULL,'北海道系拉麵，濃厚豚骨湯底，叉燒入口即化','環球購物中心內用餐方便',4,'山頭火拉麵 中和環球店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (272,215,1,'Don''ts Don''ts Pasta 懂吃懂吃','義大利麵','11:30~14:30 / 17:00~21:30','NT$120~220','不需訂位',NULL,'永和樂華夜市旁浮誇系義大利麵，蛤蜊多到爆盤CP值超高','蛤蜊份量驚人必點',4.5,'Don''ts Don''ts Pasta 懂吃懂吃',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (273,215,2,'竹林雞肉飯','特色小吃','11:00~20:00','NT$40~100','不需訂位',NULL,'永安市場旁超人氣，雞肉飯油蔥香氣誘人','晚餐前會收注意時間',4.1,'竹林雞肉飯',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (274,217,0,'麵屋和和','日式拉麵','11:00~20:30','NT$200~320','不需訂位',NULL,'中和四號公園旁文青風拉麵，雞清湯與雞白湯專賣，細麵彈牙','文青風格環境舒適',4,'麵屋和和',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (275,217,1,'Win Win Pasta 景安店','義大利麵','11:00~21:00','NT$150~280','不需訂位',NULL,'景安站對面高CP值義式，比臉大焗烤招牌，濃湯飲料無限暢飲','濃湯飲料無限暢飲',4.3,'Win Win Pasta 景安店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (276,217,2,'中和連城路米粉湯','特色小吃','06:00~14:00','NT$40~80','不需訂位',NULL,'中和在地早午餐，清甜米粉湯配上油豆腐黑白切','僅早午餐時段營業',4,'中和連城路米粉湯',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (277,219,0,'一幸拉麵 中和莒光店','日式拉麵','11:30~14:00 / 17:00~21:00','NT$170~280','不需訂位',NULL,'中和最強拉麵，泡系雞白湯與柚子鹽風味獨特，免費加麵加飯','分午晚兩時段注意休息',4.8,'一幸拉麵 中和莒光店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (278,219,1,'洋城義大利餐廳 中和店','義大利麵','11:00~21:30','NT$280~480','不需訂位',NULL,'連鎖義式餐廳，白醬義大利麵與焗烤料理份量十足，適合家庭聚餐','適合家庭聚餐用餐',4,'洋城義大利餐廳 中和店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (279,219,2,'阿男麻辣鍋','特色小吃','17:00~01:00','NT$350~600','建議訂位',NULL,'中和人氣麻辣鍋，花椒麻香十足，鴨血豆腐無限續','建議訂位且鴨血可續加',4.2,'阿男麻辣鍋',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (280,221,0,'麵屋鴒','日式拉麵','11:30~13:30 / 17:00~21:00','NT$220~350','不需訂位',NULL,'永安市場站旁泡系雞白湯拉麵，湯頭厚實清爽不油膩','午晚分兩時段中間休息',4.6,'麵屋鴒',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (281,221,1,'禾多靜巷 Herdor Near','義大利麵','11:00~21:00','NT$280~450','建議訂位',NULL,'新埔站旁鬧中取靜義式餐廳，自家農場無毒米燉飯，料理水準高','建議訂位以免向隅',4.3,'禾多靜巷 Herdor Near',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (282,221,2,'池上木片便當 永和店','特色小吃','10:30~20:00','NT$80~120','不需訂位',NULL,'古早味木片便當，排骨飯與雞腿飯最受歡迎','外帶方便適合野餐',4,'池上木片便當 永和店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (283,224,0,'麵屋武藏 樹林中山店','日式拉麵','11:00~21:30','NT$260~380','不需訂位',NULL,'日本名店在台分店，濃郁豚骨醬油湯底，粗直麵條吸飽湯汁','日本名店品質穩定',4.1,'麵屋武藏 樹林中山店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (284,224,1,'UNO 義式廚房 樹林店','義大利麵','11:30~21:00','NT$230~380','不需訂位',NULL,'樹林義式餐廳，手工義大利麵搭配現炒醬汁，牛肉義大利麵份量扎實','牛肉義大利麵份量扎實',3.9,'UNO 義式廚房 樹林店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (285,224,2,'土城中央路四號米粉湯','特色小吃','06:30~14:00','NT$40~80','不需訂位',NULL,'土城在地人推薦，清甜米粉湯配黑白切經濟實惠','僅早午餐時段營業',4,'土城中央路四號米粉湯',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (286,226,0,'一蘭拉麵 土城永寧店','日式拉麵','10:00~23:00','NT$320~420','不需訂位',NULL,'日本知名連鎖豚骨拉麵，秘製紅辣醬可自由調整，獨立隔間專注品嚐','營業到深夜不趕時間',4.2,'一蘭拉麵 土城永寧店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (287,226,1,'只是光在 義大利麵 土城店','義大利麵','11:00~21:00','NT$220~360','不需訂位',NULL,'土城義式輕食餐廳，手工義大利麵條口感紮實，青醬與蕃茄肉醬最受好評','青醬口味最受好評',4,'只是光在 義大利麵 土城店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (288,226,2,'土城延和路鹽酥雞','特色小吃','16:00~00:00','NT$50~150','不需訂位',NULL,'土城超人氣鹽酥雞，蒜味十足外酥內嫩','可外帶當宵夜',4.1,'土城延和路鹽酥雞',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (289,228,0,'鬼匠拉麵 樹林店','日式拉麵','11:00~21:00','NT$180~300','不需訂位',NULL,'樹林人氣豚骨拉麵，鬼匠極究大盛系列CP值超高','CP值超高大盛必點',4.9,'鬼匠拉麵 樹林店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (290,228,1,'Marcoo手工義大利麵','義大利麵','12:00~14:00 / 18:00~21:00','NT$300~500','需預約',NULL,'樹林巷弄隱藏美食，老闆堅持全手工製麵，每季換菜單','需預約且座位僅16席',4.5,'Marcoo手工義大利麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (291,228,2,'樹林武林街滷肉飯','特色小吃','06:00~14:00','NT$30~60','不需訂位',NULL,'樹林在地老店，古早味滷肉飯油亮鹹香','僅早午餐時段營業',4,'樹林武林街滷肉飯',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (292,231,0,'上津日式拉麵','日式拉麵','11:00~21:00','NT$79~169','不需訂位',NULL,'樹林車站旁超平價拉麵，每日限量30碗，紅燒牛肉麵也值得試','每日限量30碗要早去',4,'上津日式拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (293,231,1,'享義','義大利麵','11:30~15:00 / 17:00~20:00','NT$200~350','不需訂位',NULL,'舒肥牛排番茄義大利麵與奶油野菇燉飯樣樣好吃','午晚分兩時段注意休息',4.3,'享義',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (294,231,2,'山佳老街切仔麵','特色小吃','07:00~15:00','NT$40~80','不需訂位',NULL,'山佳車站旁小吃攤，切仔麵搭配油豆腐小菜','下午三點就收攤',4,'山佳老街切仔麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (295,233,0,'桐生拉麵 土城店','日式拉麵','11:30~14:00 / 17:30~21:30','NT$220~350','不需訂位',NULL,'土城人氣拉麵，夢幻湖水藍鹽味翠雞拉麵，醬油雞湯也必點','晚餐17:30才開門',4.4,'桐生拉麵 土城店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (296,233,1,'No.66義麵坊 土城店','義大利麵','11:00~21:00','NT$120~200','不需訂位',NULL,'土城平價義大利麵連鎖，用料實在價格親民','平價連鎖品質穩定',4.2,'No.66義麵坊 土城店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (297,233,2,'樹林保安街夜市','特色小吃','17:00~23:00','NT$50~150','不需訂位',NULL,'在地人的晚餐街，各式台灣小吃集中','小吃選擇多可邊走邊吃',4,'樹林保安街夜市',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (298,235,0,'麵屋輝 淡水店','日式拉麵','11:00~21:00','NT$200~300','不需訂位',NULL,'淡水在地人推薦的日式拉麵店，雞豚混合湯底清甜，手工麵條彈牙','在地人推薦的隱藏版',4.2,'麵屋輝 淡水店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (299,235,1,'滬尾義式廚房','義大利麵','11:30~21:00','NT$280~480','建議訂位',NULL,'淡水河畔的義式餐廳，手工義大利麵配淡水河景，海鮮義大利麵最受歡迎','建議訂位享河景座位',4.1,'滬尾義式廚房',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (300,235,2,'文化阿給','特色小吃','06:30~18:00','NT$35~60','不需訂位',NULL,'淡水阿給創始店之一，冬粉塞入油豆腐再封魚漿','下午就打烊建議早去',4.1,'文化阿給',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (301,237,0,'二月拉麵','日式拉麵','11:00~14:00 / 17:00~21:00','NT$180~300','不需訂位',NULL,'淡水在地人公認最好吃拉麵，免費加麵，客製化麵條硬度與鹹度','可客製麵條硬度鹹度',4.4,'二月拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (302,237,1,'之間 茶食器','義大利麵','11:30~21:00','NT$300~500','建議訂位',NULL,'淡水河畔複合式餐廳，義式料理配淡水河景','建議訂位享河畔座位',4.3,'之間 茶食器',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (303,237,2,'淡水福佑宮旁海鮮','特色小吃','11:00~21:00','NT$200~500','不需訂位',NULL,'淡水在地海鮮餐廳，現撈海產清蒸煮炒樣樣有','現撈海鮮新鮮度佳',4,'淡水福佑宮旁海鮮',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (304,239,0,'麵屋敬太','日式拉麵','12:00~15:00 / 17:00~19:30','NT$200~320','不需訂位',NULL,'日籍師傅掌廚煮干拉麵，澎湖丁香魚熬製湯頭濃郁鮮美','中午才開且分兩時段',4.4,'麵屋敬太',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (305,239,1,'安乘漁人碼頭店','義大利麵','11:00~21:00','NT$250~450','建議訂位',NULL,'碼頭景觀餐廳，手工義大利麵配河口夕陽','建議訂位享碼頭景觀',4,'安乘漁人碼頭店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (306,239,2,'漁人碼頭海鮮餐廳','特色小吃','11:00~21:00','NT$200~500','不需訂位',NULL,'碼頭旁現撈海鮮，清蒸鮮魚與炒蛤蜊鮮甜','碼頭旁海鮮新鮮',3.9,'漁人碼頭海鮮餐廳',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (307,241,0,'鷄道樂','日式拉麵','12:00~14:00 / 17:00~21:00','NT$220~350','不需訂位',NULL,'淡水老街廣場排隊名店，松露雞白湯拉麵濃厚香純','排隊名店建議提早到',4.4,'鷄道樂',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (308,241,1,'八里水岸義式景觀餐廳','義大利麵','11:00~21:00','NT$280~500','建議訂位',NULL,'八里左岸景觀義式餐廳，手工義大利麵配觀音山與淡水河視野，夕陽時分最美','建議訂位賞夕陽河景',4,'八里水岸義式景觀餐廳',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (309,241,2,'淡水老街許義魚酥','特色小吃','09:00~20:00','NT$30~80','不需訂位',NULL,'淡水百年魚酥店，現炸魚酥香脆，搭配阿給超滿足','現炸魚酥適合當伴手禮',4.2,'淡水老街許義魚酥',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (310,243,0,'豚將拉麵 淡水店','日式拉麵','11:00~21:00','NT$150~280','不需訂位',NULL,'淡水平價連鎖拉麵，無限供應加麵吃到飽，商業午餐CP值高','無限加麵吃到飽超值',4.2,'豚將拉麵 淡水店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (311,243,1,'兔宅子','義大利麵','12:00~14:00 / 17:00~20:00','NT$200~350','建議訂位',NULL,'淡水社團激推義大利麵，巷弄小店僅16席，不收服務費','僅16席需提前預約',4.9,'兔宅子',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (312,243,2,'八里渡船頭雙胞胎','特色小吃','09:00~19:00','NT$15~30','不需訂位',NULL,'八里老街必吃炸物，雙胞胎甜甜圈外酥內軟','現炸趁熱吃最好',4.3,'八里渡船頭雙胞胎',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (313,245,0,'七條通日式煎餃拉麵','日式拉麵','11:00~20:00','NT$80~200','不需訂位',NULL,'淡水老街旁重建街上30年老店，現煎日式煎餃與拉麵','30年老店煎餃必點',4.2,'七條通日式煎餃拉麵',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (314,245,1,'提立歐義式餐廳','義大利麵','11:30~14:30 / 17:30~21:30','NT$250~450','建議訂位',NULL,'八里左岸義式餐廳，炙燒牛排肉汁麵份量十足，河岸用餐氣氛佳','建議訂位享河岸景觀',4.1,'提立歐義式餐廳',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (315,245,2,'八里佘家孔雀蛤大王','特色小吃','11:00~21:00','NT$100~300','不需訂位',NULL,'八里名產孔雀蛤，九層塔大火快炒鮮甜入味','八里必吃名產',4,'八里佘家孔雀蛤大王',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (316,249,0,'烤肉的男子 西面店','燒肉','11:00~22:00','₩15,000~25,000/人','現場候位',NULL,'人氣韓式烤肉店，厚切五花肉現烤','午餐時段人較少不用久等',4,'고기리남자 서면점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (317,249,1,'DIART Coffee','咖啡廳','10:00~22:00','₩8,000~15,000/人','不需訂位',NULL,'西面人氣咖啡廳，提供早午餐與甜點','二樓座位空間較寬敞',4.5,'디아트커피 서면',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (318,249,2,'紫菜包飯天國 西面店','地方特色','24小時','₩3,000~6,000/人','不需訂位',NULL,'平價韓式連鎖，紫菜包飯、拉麵、炒飯一應俱全','24小時營業適合趕時間',3.8,'김밥천국 서면점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (319,253,0,'老宅邸燒肉','燒肉','16:00~23:00','₩18,000~35,000/人','建議訂位',NULL,'釜山人氣燒肉名店，醬燒豬五花、韓牛套餐','週五晚間建議提前訂位',4,'고택집 서면',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (320,253,1,'Coffee Nine','咖啡廳','11:00~22:00','₩6,000~12,000/人','不需訂位',NULL,'西面質感咖啡廳，輕食與手沖咖啡','適合輕食晚餐不想吃太飽',4,'커피나인 서면',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (321,253,2,'할매가야밀면','地方特色','10:00~21:00','₩7,000~9,000/人','不需訂位',NULL,'釜山名物密麵（冷麵），50年老店','釜山必吃密麵。夏天推薦冷麵',3.9,'할매가야밀면 서면',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (322,255,0,'新村食堂 西面店','燒肉','11:00~22:00','₩12,000~18,000/人','不需訂位',NULL,'連鎖韓式烤肉，招牌烤七味豬五花','七味五花是招牌必點',4.2,'새마을식당 서면점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (323,255,1,'Liberta','咖啡廳','10:00~22:00','₩8,000~15,000/人','不需訂位',NULL,'釜山人氣早午餐咖啡廳，質感空間','早午餐份量大適合當午餐',4.5,'리베르타 부산',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (324,255,2,'山青豬肉湯飯','地方特色','07:00~22:00','₩8,000~10,000/人','不需訂位',NULL,'釜山名物豬肉湯飯，濃郁白湯配嫩豬肉','釜山必吃。湯飯可免費續飯',4.3,'산청돼지국밥 서면점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (325,259,0,'姜虎東白丁 南浦店','燒肉','11:30~23:00','₩15,000~25,000/人','建議訂位',NULL,'韓國知名連鎖燒肉，姜虎東親自代言','週末晚間需等位約30分鐘',4,'강호동백정 남포점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (326,259,1,'Momos Coffee 南浦店','咖啡廳','09:00~22:00','₩5,000~10,000/人','不需訂位',NULL,'釜山在地精品咖啡品牌，手沖與甜點','釜山代表性咖啡品牌',4.5,'모모스커피 남포점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (327,259,2,'明卵紫菜飯捲','地方特色','10:00~21:00','₩4,000~7,000/人','不需訂位',NULL,'釜山特色明太子紫菜飯捲，料多味美','外帶到海邊吃也很讚',4.1,'명란김밥 남포동',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (328,262,0,'八色烤肉 海雲台店','燒肉','11:00~22:00','₩14,000~20,000/人','建議訂位',NULL,'八種口味醃漬五花肉，韓國連鎖烤肉名店','八種口味一次滿足',4.1,'팔색삼겹살 해운대점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (329,262,1,'삼성커피숍','咖啡廳','10:00~20:00','₩5,000~8,000/人','不需訂位',NULL,'機張在地咖啡廳，復古氛圍','在地人才知道的隱藏小店',4,'삼성커피숍 기장',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (330,262,2,'海女村海鮮','地方特色','09:00~21:00','₩15,000~30,000/人','不需訂位',NULL,'機張名物，現撈海鮮、鮑魚、海膽直接品嚐','現選現煮。建議多人合點',4,'기장 해녀촌',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (331,263,0,'肉典食堂 廣安里店','燒肉','11:30~22:00','₩15,000~25,000/人','建議訂位',NULL,'人氣烤肉店，招牌醬烤牛排骨','醬烤牛排骨是必點招牌',4.6,'육전식당 광안리점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (332,263,1,'연경재','咖啡廳','11:00~22:00','₩6,000~10,000/人','不需訂位',NULL,'傳統韓屋改建咖啡廳，古典與現代融合','韓屋氛圍很適合拍照打卡',4.5,'연경재 부산',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (333,263,2,'明星一隻雞','地方特色','11:00~22:00','₩25,000~30,000/鍋（2~3人份）','建議訂位',NULL,'韓式一隻雞鍋，整隻嫩雞燉煮、馬鈴薯年糕入味','三人合點一鍋份量剛好',4.5,'명성닭한마리 부산',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (334,267,0,'伍班長烤肉 海雲台店','燒肉','11:00~22:00','₩14,000~20,000/人','建議訂位',NULL,'招牌調味烤五花，配上生菜包肉超滿足','午間套餐價格較實惠',4.1,'오반장 해운대점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (335,267,1,'TIDE Coffee Roasters','咖啡廳','09:00~19:00','₩6,000~10,000/人','不需訂位',NULL,'海雲台達麗海岸精品咖啡，自家烘焙、手沖單品','釜山評價最高的精品咖啡',4.9,'타이드커피로스터스',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (336,267,2,'大海鮑魚粥','地方特色','08:00~21:00','₩12,000~18,000/人','不需訂位',NULL,'鮮甜鮑魚粥，整顆鮑魚入粥，健康養生','養生清淡。適合前晚吃太多',4.3,'대해전복죽 해운대',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (337,270,0,'맛찬들왕소금구이 海雲台店','燒肉','12:00~23:00','₩15,000~25,000/人','建議訂位',NULL,'14天熟成豬五花專門店，全程專人代烤','專人代烤不用自己動手',4.3,'맛찬들왕소금구이 해운대직영점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (338,270,1,'Blue House on The Stairs','咖啡廳','10:00~21:00','₩6,000~10,000/人','不需訂位',NULL,'階梯上的藍色房子，海景咖啡廳','日落時段景觀最美',4.4,'파란집 그 계단위 부산',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (339,270,2,'청사포 장어구이','地方特色','11:00~21:00','₩20,000~35,000/人','不需訂位',NULL,'青沙埔名物烤鰻魚，炭火直烤鮮嫩多汁','青沙埔在地名物。值得一試',4,'청사포 장어구이',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (340,274,0,'삼환축산 南浦店','燒肉','12:00~23:00','₩15,000~33,000/人','建議訂位',NULL,'南浦洞人氣烤肉店，現切熟成豬五花、自助沙拉吧','自助沙拉吧無限供應',4.2,'삼환축산 남포점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (341,274,1,'三進魚板閣','咖啡廳','10:00~20:00','₩5,000~8,000/人','不需訂位',NULL,'釜山魚板老店附設咖啡廳，魚板可樂餅搭咖啡','魚板可樂餅是招牌必點',4.3,'삼진어묵다락',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (342,274,2,'李在模披薩','地方特色','11:00~21:00','₩15,000~22,000/張','不需訂位',NULL,'釜山在地披薩名店，傳統手工窯烤披薩','釜山在地人推薦的披薩店',4.2,'이재모피자 부산',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (343,276,0,'喉嚨鍋蓋烤肉 南浦店','燒肉','15:30~01:00','₩15,000~25,000/人','建議訂位',NULL,'鍋蓋烤肉專門店，現點現切、專人代烤','出餐快。適合趕飛機前吃',4.3,'목구멍 남포점',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (344,276,1,'탑플로어','咖啡廳','12:00~22:30','₩5,000~8,000/人','不需訂位',NULL,'BIFF 廣場旁人氣蛋糕咖啡廳，手工起司蛋糕搭配咖啡','起司蛋糕是招牌必點',4.3,'탑플로어 남포동',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (345,276,2,'廣安里海鮮麵','地方特色','10:00~21:00','₩8,000~12,000/人','不需訂位',NULL,'釜山特色海鮮刀削麵，滿滿蛤蜊海鮮湯頭','出餐快且平價。趕時間首選',4.5,'광안리 해물칼국수',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (346,281,0,'京都拉麵小路','京都料理','11:00~22:00','¥900~1200','不需預約',NULL,'京都車站10F，集結全國知名拉麵店','平日也需排隊',3.9,'京都拉麵小路',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (347,281,1,'はしたて','和食','11:00~16:00','¥1200~1800','不需預約，排隊制',NULL,'京都車站 The CUBE 內，京都和食人氣店','下午常提早售完',3.8,'はしたて',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (348,281,2,'志津屋 京都駅店','洋食','07:30~21:00','¥400~800','不需預約',NULL,'京都老牌麵包店，招牌カルネ三明治','招牌カルネ必買',3.9,'志津屋 京都駅店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (349,287,0,'先斗町 いづもや','京都料理','17:00~22:00','¥3000~5000','建議預約',NULL,'先斗町老舖，京風鰻魚與會席料理','鰻魚飯是招牌',3.8,'先斗町 いづもや',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (350,287,1,'木屋町 串くら 本店','和食','17:30~23:00','¥3000~5000','建議預約',NULL,'京地雞串燒名店，炭火串焼き','推薦雞肉串燒拼盤',4.1,'串くら 本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (351,287,2,'壹銭洋食','洋食','11:00~翌3:00','¥600~1000','不需預約',NULL,'京都版大阪燒，昭和懷舊風','深夜也營業',4,'壹銭洋食',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (352,291,0,'しゅばく','京都料理','11:00~16:00','¥1000~1500','不需預約',NULL,'手打蕎麥麵名店，宇治在地推薦','手打蕎麥口感佳',4.3,'しゅばく',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (353,291,1,'伊藤久右衛門 本店','和食','10:00~18:00','¥1200~1800','不需預約',NULL,'宇治抹茶蕎麥麵與抹茶甜點','抹茶蕎麥麵必吃',4.2,'伊藤久右衛門 本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (354,291,2,'通圓 宇治本店','洋食','09:30~17:30','¥800~1500','不需預約',NULL,'創業 850 年茶屋，茶蕎麥與甜點','850年歷史老店',4.1,'通圓',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (355,297,0,'弘 木屋町店','京都料理','17:00~23:00','¥5000~8000','建議預約',NULL,'京都黑毛和牛燒肉名店','黑毛和牛必點',4.3,'弘 木屋町店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (356,297,1,'天壇 祇園本店','和食','17:00~23:00','¥5000~8000','建議預約',NULL,'京都燒肉名門，醬汁獨門配方','獨門醬汁是亮點',4.1,'天壇 祇園本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (357,297,2,'肉料理 おか','洋食','17:30~22:00','¥8000~12000','建議預約',NULL,'隱藏版肉割烹，京都和牛料理','隱藏名店需預約',4.4,'肉料理 おか',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (358,303,0,'麺屋猪一 離れ','京都料理','11:00~15:00','¥900~1200','不需預約，排隊制',NULL,'米其林推薦拉麵，醬油清湯系','米其林推薦必吃',4.2,'麺屋猪一 離れ',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (359,303,1,'mumokuteki cafe','和食','11:30~21:00','¥1200~1800','不需預約',NULL,'蔬食咖啡廳，健康和風料理','蔬食友善餐廳',4.1,'mumokuteki cafe',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (360,303,2,'キルフェボン 京都','洋食','11:00~19:00','¥800~1500','不需預約',NULL,'季節水果塔名店','季節水果塔必點',4.2,'キルフェボン 京都',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (361,308,0,'赤垣屋','京都料理','17:00~22:30','¥2000~4000','不需預約',NULL,'百年居酒屋，京都在地人推薦','百年老店氣氛佳',4,'赤垣屋',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (362,308,1,'酒陶 柳野','和食','17:30~23:00','¥3000~5000','建議預約',NULL,'京風割烹居酒屋，當季食材','當季食材為主',4.1,'酒陶 柳野',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (363,308,2,'スタンド きのした','洋食','18:00~翌1:00','¥2000~4000','不需預約',NULL,'站立式酒場，創作料理配自然酒','自然酒搭配好',4.2,'スタンド きのした',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (364,313,0,'かね正','京都料理','11:30~14:00, 17:00~20:00','¥2500~4000','建議預約',NULL,'祇園鰻魚名店，きんし丼必吃','きんし丼是招牌',4,'かね正',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (365,313,1,'京極かねよ','和食','11:30~20:30','¥2000~3500','不需預約',NULL,'百年鰻魚老舖，巨大玉子燒蓋飯','巨大玉子燒必看',3.9,'京極かねよ',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (366,313,2,'グリル小宝','洋食','11:30~21:00','¥1200~1800','不需預約',NULL,'昭和洋食名店，招牌巨大蛋包飯','蛋包飯份量超大',4.2,'グリル小宝',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (367,316,0,'三嶋亭 本店','京都料理','11:00~21:00','¥10000~15000','建議預約',NULL,'1873年創業壽喜燒老舖','150年歷史名店',4.3,'三嶋亭 本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (368,316,1,'モリタ屋 木屋町店','和食','11:30~22:00','¥6000~10000','建議預約',NULL,'京都和牛壽喜燒涮涮鍋','涮涮鍋也推薦',4.2,'モリタ屋 木屋町店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (369,316,2,'十二段家 本店','洋食','11:30~21:30','¥5000~8000','建議預約',NULL,'壽喜燒涮涮鍋老舖，白味噌風味','白味噌風味獨特',4,'十二段家 本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (370,320,0,'名代とんかつ かつくら 四条東洞院店','京都料理','11:00~21:30','¥1500~2500','不需預約',NULL,'京都在地豬排名店，麥飯白菜吃到飽','麥飯白菜吃到飽',4.1,'かつくら 四条東洞院店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (371,320,1,'祢ざめ家','和食','10:00~18:00','¥1000~2000','不需預約',NULL,'伏見稻荷參道名物鰻魚飯與鯖壽司','參道旁吃完再走',3.8,'祢ざめ家',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (372,320,2,'グリルキャピタル東洋亭 ポルタ店','洋食','11:00~22:00','¥1500~2500','不需預約',NULL,'明治30年創業百年洋食，招牌丸ごとハンバーグ','漢堡排是招牌',4.1,'グリルキャピタル東洋亭 ポルタ店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (373,323,0,'ジャンボ 本店','京都料理','12:00~22:00','¥800~1500','不需預約',NULL,'京都大阪燒名店，超大份量','份量超大很划算',4.1,'ジャンボ 本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (374,323,1,'吉野 祇園店','和食','11:30~22:00','¥800~1500','不需預約',NULL,'鐵板燒/大阪燒老舖','祇園逛完順路吃',4,'吉野 祇園店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (375,323,2,'開陽亭','洋食','17:30~22:00','¥4000~5000','建議預約',NULL,'大正4年創業老舖洋食，歐風料理與紅酒','大正時代老店',4.1,'開陽亭',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (376,328,0,'Town Gate Cafe','京都料理','07:00~21:00',NULL,'不需預約',NULL,'關西機場管制區內美食街','管制區內免趕時間',3.5,'Town Gate Cafe',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (377,332,0,'まぐろ問屋 やざえもん 那覇店','生魚片','11:00~15:00 / 17:00~22:00','¥1,000~','建議預約',NULL,'鮪魚專門迴轉壽司，生鮪魚丼・海鮮丼，午餐 ¥1,000 起','午餐時段CP值高',4,'まぐろ問屋やざえもん 那覇店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (378,332,1,'ステーキハウス88 國際通店','燒肉','11:00~22:00','¥1,500~¥4,000','免預約',NULL,'沖繩老牌牛排館，200g 沙朗 ¥2,200 起，附湯和沙拉','沖繩必吃老字號牛排',4,'ステーキハウス88 国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (379,332,2,'お食事処 みかど','地方特色','10:00~21:30','¥650~¥900','免預約，食堂形式',NULL,'沖繩在地食堂60年老店，ゆし豆腐定食・沖繩強棒飯，¥650~900','平價在地食堂。現金結帳',4,'お食事処 みかど 那覇松山',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (380,336,0,'海鮮居酒屋 鰓呼吸 那覇久茂地店','生魚片','17:00~24:00','¥3,000~','可預約',NULL,'全國260港口直送鮮魚，刺身拼盤・炙燒・蒸籠料理','港口直送鮮度佳。深夜營業',4.1,'鰓呼吸 那覇久茂地店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (381,336,1,'焼肉 琉球の牛 那覇国際通り店','燒肉','17:00~22:30','¥5,000~','強烈建議線上訂位 TableCheck','https://www.tablecheck.com/en/shops/yakiniku-naha/reserve','嚴選沖繩縣產和牛，Google 評分 4.7 的人氣燒肉店','超人氣店。務必提前訂位',4.8,'焼肉 琉球の牛 那覇国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (382,336,2,'ゆうなんぎい','地方特色','17:00~22:00（週日休）','¥1,500~¥3,000','建議預約',NULL,'國際通旁沖繩鄉土料理名店，Rafute 紅燒三層肉・地魚刺身必點','週日公休。鄉土料理必訪',4.5,'ゆうなんぎい 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (383,340,0,'海鮮食堂 太陽 南城店','生魚片','11:00~15:00','¥1,000~¥1,800','免預約',NULL,'南城在地海鮮食堂，鮮魚刺身定食・海鮮丼，地魚新鮮','午餐限定。售完提早關',4,'海鮮食堂 太陽 南城店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (384,340,1,'沖繩世界園區內餐廳','燒肉','09:00~17:00','¥800~¥1,500','免預約',NULL,'園區內沖繩料理定食，也有牛排・燒肉定食','逛園區順便用餐最方便',4,'沖繩世界 おきなわワールド',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (385,340,2,'カフェくるくま','地方特色','10:00~18:00','¥1,000~¥1,500','免預約',NULL,'南城海景咖啡廳，藥膳咖哩・泰式料理，太平洋絕景座席','海景座位要提早到',4,'カフェくるくま 南城',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (386,343,0,'本マグロ炉端劇場 魚島屋 久茂地本店','生魚片','17:00~24:00（水曜定休）','¥3,000~','可預約',NULL,'本鮪魚專門居酒屋，劇場式炉端燒，鮪魚刺身・握壽司・炭烤海鮮','週三公休。劇場氣氛佳',4,'魚島屋 久茂地本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (387,343,1,'宮崎牛専門店 那覇みやちく','燒肉','午餐 11:00~15:00 / 晚餐 17:00~22:00（週一公休）','¥10,000~','強烈建議預約（電話 098-943-2978 或線上）','https://www.hotpepper.jp/strJ003762625/','四連霸日本全國和牛冠軍宮崎牛，鐵板燒＋龍蝦套餐','頂級和牛。預算較高',4.9,'宮崎牛専門店 那覇みやちく',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (388,343,2,'しまぶた屋 那覇店','地方特色','17:00~23:00','¥3,000~¥5,000','建議預約',NULL,'沖繩阿古豬涮涮鍋・炙燒豬肉，在地食材料理','阿古豬涮涮鍋必點',4.3,'しまぶた屋 那覇店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (389,347,0,'名護漁港 水産物直売所','生魚片','08:00~18:00','¥800~¥1,500','免預約',NULL,'名護漁港直營，鮮魚刺身・海鮮丼，漁港直送最新鮮','漁港直營。新鮮度極高',4,'名護漁港 水産物直売所',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (390,347,1,'焼肉もとぶ牧場 本部店','燒肉','11:00~22:00','¥3,000~','建議預約',NULL,'牧場直營本部牛，A4-A5 等級和牛燒肉','牧場直營。品質有保障',4,'焼肉もとぶ牧場 本部店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (391,347,2,'岸本食堂','地方特色','11:00~17:00（週三休）','¥600~¥1,000','免預約',NULL,'本部町百年沖繩そば老店，手打粗麵＋三層肉，週三休','百年老店。週三公休注意',4,'岸本食堂 本部町',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (392,350,0,'牧志公設市場 2F 食堂','生魚片','10:00~20:00','¥2,000~¥4,000','免預約',NULL,'1F 買海鮮 2F 代客料理，生魚片・龍蝦・夜光貝，現買現吃最新鮮','現買現做。體驗感十足',4,'牧志公設市場 2F',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (393,350,1,'ジャッキーステーキハウス','燒肉','11:00~22:00（水曜定休）','¥1,500~¥4,000','免預約（排隊名店）',NULL,'1953年創業沖繩最老牌牛排館，テンダーロイン 250g ¥3,800，附湯和沙拉','排隊名店。建議避開尖峰',4.1,'ジャッキーステーキハウス 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (394,350,2,'山羊料理 さかえ','地方特色','17:00~22:00','¥2,000~¥4,000','建議預約',NULL,'沖繩傳統山羊料理，山羊汁・山羊刺身，在地人推薦','口味特殊。適合愛嘗鮮者',4,'山羊料理さかえ 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (395,353,0,'海人食堂','生魚片','11:00~15:00（售完為止）','¥800~¥1,500','免預約',NULL,'北谷漁港直營海鮮食堂，刺身定食・海鮮丼，漁師直送','售完即止。建議早點去',4,'海人食堂 北谷',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (396,353,1,'燒肉きんぐ 北谷店','燒肉','11:30~23:00','¥3,278~','可線上預約','https://epark.jp/shopinfo/fsp589608/','燒肉吃到飽 ¥3,278 起，食べ放題含和牛','吃到飽。適合大食量者',4,'焼肉きんぐ 北谷店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (397,353,2,'浜屋そば','地方特色','10:00~20:00','¥700~¥1,000','免預約',NULL,'北谷人氣沖繩そば老店，軟骨排骨そば・三層肉そば','在地人氣老店。平價',4,'浜屋そば 北谷',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (398,357,0,'海鮮酒場 琉星','生魚片','17:00~24:00','¥3,000~','可預約',NULL,'國際通徒步1分鐘，店內生簀可釣魚現做刺身，縣產鮮魚料理','可體驗自己釣魚做刺身',3.8,'海鮮酒場 琉星 那覇久茂地',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (399,357,1,'焼肉本舗 島牛','燒肉','午餐 11:30~14:30 / 晚餐 17:00~23:00','¥3,500~','電話或網路預約',NULL,'那霸松山在地老店，沖繩縣產和牛・阿古豬炭火燒肉','在地老店。炭火燒肉香',3.9,'焼肉本舗 島牛 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (400,357,2,'郷土料理 ここ','地方特色','18:00~00:00（全年無休）','¥3,000~¥5,000','可電話預約 098-866-5255',NULL,'沖繩鄉土料理＋現場三線琴演奏，おまかせコース ¥3,500','有三線琴現場演奏',4,'郷土料理 ここ 那覇松尾',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (401,361,0,'親父のまぐろ','生魚片','11:00~20:30','¥1,000~¥1,500','免預約',NULL,'瀨長島 Umikaji Terrace 內，漁師父親一本釣縣產生鮪魚丼・アヒポキライス','一本釣鮪魚。鮮度極佳',4,'親父のまぐろ 瀬長島',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (402,361,1,'やっぱりステーキ 國際通店','燒肉','11:00~翌02:00','¥1,000~¥2,500','免預約',NULL,'CP 值超高！¥1,000 起的溶岩石板牛排，附湯飯沙拉吃到飽','千圓牛排。CP值超高',4,'やっぱりステーキ 国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (403,361,2,'沖縄そば処 もとぶ熟成麺','地方特色','11:00~20:00','¥700~¥1,200','免預約',NULL,'瀨長島 Umikaji Terrace 內，自家製熟成麵，V3そば（三種肉）・香ネギそば','自家製熟成麵。口感Q彈',3.8,'もとぶ熟成麺 瀬長島',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (439,416,0,'空港食堂','沖繩料理','09:00~20:00','¥600~','{"available":"no","recommended":false}',NULL,'隱藏版員工食堂，在地人也愛吃','1F到達大廳旁較隱密',4,'空港食堂 那覇空港',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (440,416,1,'天龍 那覇空港店','海鮮','07:00~20:30','¥800~','{"available":"no","recommended":false}',NULL,'沖繩そば＆定食老店，機場人氣名店','機場內老字號人氣店',3.8,'天龍 那覇空港店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (441,416,2,'ポーたま 那覇空港国内線到着ロビー店','甜點','07:00~21:00（年中無休）','¥350~','{"available":"no","recommended":false}',NULL,'ポーたま — 沖繩名物ポークたまごおにぎり專門店，注文後手作り，エビフライ・ゴーヤ天ぷら等多種口味','現點現做可外帶上飛機',4,'ポーたま 那覇空港国内線','33 123 279*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (442,424,0,'牛骨琉球ラーメン MARUMARO 北谷店','拉麵','11:30~15:00, 17:30~21:30','¥980~','不需訂位',NULL,'沖繩唯一牛骨琉球拉麵！濃厚牛骨湯頭配自家製中太麵，美國村 Depot Island 內','午休到17:30。晚餐場注意時段',4,'牛骨琉球ラーメン MARUMARO 北谷店','33 526 450*63','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (443,424,1,'焼肉きんぐ 北谷店','燒肉','平日 17:00~24:00／土日祝 11:00~24:00','¥3,498~/人（100分鐘食べ放題）','EPARK 預約','https://epark.jp/shop/shop-menu/6702/','全國人氣燒肉吃到飽！タッチパネル注文，肉品種類豐富','暑假必EPARK預約。最終入店23:00',4,'焼肉きんぐ 北谷店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (444,424,2,'サムズマウイ 北谷店','當地特色','17:00~23:00（無休）','¥3,000~','電話預約',NULL,'沖繩老牌鉄板焼パフォーマンス！目の前でシェフが豪快に調理，A5 和牛＆ロブスター','鐵板秀精彩。建議提前電話預約',4.3,'サムズマウイ 北谷',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (445,427,0,'青潛 Best Dive Okinawa','浮潛','08:00~17:00','~¥8,000/人（含船費＋拍照20張以上）','官網預約','https://www.bestdiveokinawa.com/','全中文（國語/廣東話/台語），搭船前往免排隊，4歲可參加','自有停車場＋接駁車。搭船免爬階梯。含免費拍照',4.8,'Best Dive Okinawa 青之洞窟',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (446,427,1,'Natural Blue 自然之藍','浮潛','08:00~17:00','~¥5,500/人（未稅）','官網預約','https://www.natural-blue.net/tw/','台灣人中文教練，沖繩安全優良店認證，CP 值最高','僅收日幣現金。6歲以上。CP值最高',4.8,'Natural Blue 青之洞窟',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (447,427,2,'黑潮潛水 Kuroshio Diving','浮潛','08:00~17:00','~¥8,000/人（全包無隱藏費用）','官網預約','https://heichaodive.com/','台灣籍教練常駐，Klook 4.9 分，搭船免爬階梯','9歲以上。Klook預約有折扣',4.7,'黑潮潛水 青之洞窟',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (448,429,0,'なかむらそば','沖繩麵','11:00~17:30（週三公休・售完即止）','¥600~','不需訂位',NULL,'恩納村人氣沖繩麵！海景テラス席，手作麵條','海景座位很棒。售完即止',4.3,'なかむらそば 恩納','206 096 831*55','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (449,429,1,'焼肉げんか','燒肉','午 11:30~15:00／夜 17:00~23:00（全年無休）','¥4,000~5,000/人（含入場費）','建議預約',NULL,'原價制！入場 ¥2,200 後全餐以進貨價計算','原價制越吃越划算。建議預約',4.3,'焼肉げんか 恩納店','206 313 260*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (450,429,2,'THE GARLIC SHRIMP','當地特色','11:00~20:30（不固定休，建議出發前確認）','¥1,450~2,100','不需訂位',NULL,'粉紅小屋，6 種口味蝦蝦飯，半露天座位','粉紅小屋好認。路邊有停車位',4.1,'THE GARLIC SHRIMP 恩納','206 313 585*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (451,432,0,'麵屋 はちれん','拉麵','11:30~14:30, 18:00~22:00','¥800~','不需訂位',NULL,'名護人氣拉麵','午休到18:00。晚餐場注意時段',4.2,'麺屋はちれん 名護','206 688 326*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (452,432,1,'七輪焼肉 安安 名護店','燒肉','16:00~翌6:00（全年無休）','¥1,500~','不需訂位',NULL,'七輪炭火燒肉！安安カルビ ¥290 起，生啤也 ¥290，超平價','飯店步行10分。164席不怕沒位',3.3,'七輪焼肉 安安 名護店',NULL,'user');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (453,432,2,'レストラン ふりっぱー','當地特色','11:00~21:00（週三公休）','¥2,700~','不需訂位',NULL,'1971 年創業名護老牌牛排！ヒレステーキ','在地人最愛牛排。週三公休',4.2,'レストランふりっぱー 名護','206 717 028*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (454,437,0,'きしもと食堂','拉麵','11:00~17:00（週三公休）','¥600~','不需訂位',NULL,'明治 38 年創業！傳奇沖繩麵','百年老店常排隊。建議避開正午',4.1,'きしもと食堂 本部町','206 857 712*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (455,437,1,'焼肉もとぶ牧場 もとぶ店','燒肉','11:30~15:00（午餐 L.O.14:00）','¥1,500~','TableCheck 預約','https://www.tablecheck.com/en/shops/motobu-farm/reserve','沖繩品牌牛もとぶ牛牧場直營！水族館車程10分，午餐套餐CP值高','午餐L.O.14:00注意。第2・4週火曜定休',4.2,'焼肉もとぶ牧場 もとぶ店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (456,437,2,'海人食堂','當地特色','11:00~15:30','¥1,000~','不需訂位',NULL,'本部漁港直營食堂，新鮮生魚片','漁港直營新鮮度高。15:30關',4,'海人食堂 本部漁港','206 857 471*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (457,438,0,'KOURI SHRIMP','拉麵','11:00~18:00（不定休）','¥1,300~','不需訂位',NULL,'古宇利島人氣 No.1！夏威夷風蒜味蝦蝦飯，海景露台座位','排隊名店。建議避開正午',4,'KOURI SHRIMP 古宇利島','485 692 168*56','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (458,438,1,'しらさ食堂','燒肉','11:00~18:00（售完即止）','¥1,200~2,800','不需訂位',NULL,'古宇利島在地食堂，名物ウニ丼（海膽丼）新鮮現做','海膽丼季節限定。售完即止',4,'しらさ食堂 古宇利島','485 692 126*72','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (459,439,0,'ラーメン暖暮 名護店','拉麵','10:00~24:00（無休）','¥850~','不需訂位',NULL,'九州豚骨拉麵，曾擊敗一蘭奪冠','晚間常排隊。建議避開19點',4,'ラーメン暖暮 名護店','206 598 371*07','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (460,439,1,'焼肉五苑 名護店','燒肉','平日 17:00~22:30／假日 16:00~22:30','¥2,530~/人','官網預約','https://www.y-goen.com/webreserve_shop','吃到飽不限時間，55~115 道可選','吃到飽不限時。官網可預約',3.8,'焼肉五苑 名護店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (461,439,2,'美ら花 別邸','當地特色','17:00~22:00（週三休）','¥1,000~2,999','HotPepper 預約','https://www.hotpepper.jp/strJ000597095/','Tabelog 3.47，名護最高分沖繩料理','名護最高分沖繩料理。週三休',4,'美ら花 別邸 名護','206 444 122*78','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (462,443,0,'京都北白川ラーメン 魁力屋','拉麵','10:00~22:00','¥800~','不需訂位',NULL,'京都背脂醬油拉麵，青蔥＆醃蘿蔔免費續','青蔥免費續加很佛心',3.9,'魁力屋 イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (463,443,1,'タコライスcafe きじむなぁ','燒肉','10:00~22:00','¥780~','不需訂位',NULL,'沖繩靈魂美食！獨創歐姆蛋塔可飯（オムタコ）（當地特色）','推薦歐姆蛋塔可飯。沖繩必嚐',4.1,'タコライスcafe きじむなぁ ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (464,443,2,'博多天ぷら たかお','當地特色','10:00~22:00（L.O. 21:00）','¥1,080~','不需訂位',NULL,'博多式現炸天婦羅定食，酥脆鮮美','現炸出餐快。午餐不用等太久',4,'博多天ぷら たかお イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (465,446,0,'琉家 松尾本店','拉麵','11:30~24:00（週四公休）','¥750~','不需訂位',NULL,'國際通人氣拉麵，招牌琉焦蒜豬骨麵黑蒜油香濃','營業到深夜。逛完街再吃也OK',4.4,'琉家 松尾本店','33 157 187*60','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (466,446,1,'燒肉琉球の牛 國際通店','燒肉','17:00~23:00','¥2,000~','TableCheck 預約','https://www.tablecheck.com/en/shops/yakiniku-naha/reserve','石垣牛＋阿古豬，A5 和牛燒肉','週六超搶手。務必提前線上訂位',4.5,'琉球の牛 国際通り店','33 157 382*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (467,446,2,'Jack''s Steak House','當地特色','11:00~翌 1:00（週三公休）','¥2,000~','不需訂位',NULL,'1953 年創業！沖繩最老牌牛排','附湯沙拉白飯CP值高',4.2,'ジャッキーステーキハウス 那覇','33 155 236*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (468,450,0,'大東そば 國際通り店','拉麵','11:00~16:00（週三四公休）','¥800~','不需訂位',NULL,'南大東島傳統麵食！獨特粗麵＋柴魚豚骨湯頭，搭大東壽司絕配','16點就關。建議早點來',3.8,'大東そば 国際通り店','33 157 382*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (469,450,1,'やっぱりステーキ 4th 国際通り店','燒肉','11:00~21:00','¥1,000~','不需訂位',NULL,'沖繩發源溶岩燒牛排！200g ¥1,000 附沙拉湯飯吃到飽，CP值爆表','不需預約。人氣店用餐尖峰需排隊',4,'やっぱりステーキ 4th 国際通り店','33 157 421*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (470,450,2,'花笠食堂','當地特色','11:00~21:00','¥600~','不需訂位',NULL,'近 70 年老店！沖繩阿嬤家庭料理，定食大份量 CP 值高','大份量定食。在地人也常來吃',4,'花笠食堂 那覇','33 157 296*74','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (471,453,0,'天龍 那覇空港店','拉麵','07:00~20:30','¥800~','不需預約',NULL,'沖繩そば＆定食老店，機場人氣第一','國內線3F。出餐快適合趕飛機',3.8,'天龍 那覇空港店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (472,453,1,'ステーキハウス88 那覇空港店','燒肉','10:00~20:00','¥1,500~','不需預約',NULL,'沖繩在地牛排名店，機場也能吃到','最後一餐吃牛排。20點前要到',4,'ステーキハウス88 那覇空港店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (473,453,2,'空港食堂','當地特色','09:00~20:00','¥650~','不需預約',NULL,'機場隱藏名店！沖繩麵＆定食，空港職員也愛吃','國內線1F。價格實惠份量足',3.9,'空港食堂 那覇空港',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (474,458,0,'燒肉本部牧場 國際通店','燒肉','17:00~22:00','¥4,500~','TableCheck 線上預約','https://www.tablecheck.com/en/shops/motobu-farm-kokusai/reserve','牧場直營 A4-A5 等級本部牛，午間套餐 ¥4,500 起','建議提前線上預約',4.3,'焼肉もとぶ牧場 国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (475,458,1,'やっぱりステーキ 国際通り店','牛排/烤魚','11:00~翌1:30','¥1,000~','不需訂位',NULL,'CP值超高！¥1,000起的溶岩石板牛排','不用排隊直接入座',4.1,'やっぱりステーキ 4th 国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (476,458,2,'琉球料理 ぬちがふぅ','當地特色','11:00~22:00','¥1,500~','不需訂位',NULL,'沖繩傳統料理，套餐豐富','套餐附三線琴表演',4.2,'琉球料理ぬちがふぅ 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (477,462,0,'焼肉きんぐ 那覇おもろまち店','燒肉','平日17:00~24:00／假日11:00~24:00','¥2,980~/人（90分鐘）','EPARK 預約','https://epark.jp/shopinfo/fsp589605/','日本人氣燒肉吃到飽','建議先在EPARK預約',4,'焼肉きんぐ 那覇おもろまち店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (478,462,1,'Jack''s Steak House','牛排/烤魚','11:00~翌1:30','¥1,500~','不需訂位（排隊制）',NULL,'1953 年創業老字號美式牛排，里脊牛排嫩口多汁，CP 值極高','晚餐尖峰需排30分鐘',4.2,'ジャッキーステーキハウス',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (479,462,2,'古酒と琉球料理 うりずん','當地特色','17:30~24:00','¥2,000~','建議預約（電話 098-885-2178）',NULL,'1972年創業傳奇老舖，名物「どぅる天」山芋豆腐天婦羅發祥地','必點「どぅる天」',4.2,'古酒と琉球料理 うりずん 安里',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (480,467,0,'焼肉 琉球の牛 那覇国際通り','燒肉','17:30~23:00（LO 22:00）','¥2,900~/人','TableCheck 線上預約','https://www.tablecheck.com/en/shops/yakiniku-naha/reserve','沖繩縣產和牛專門燒肉，Google 4.7 高分人氣店','務必提前預約否則吃不到',4.7,'焼肉 琉球の牛 那覇国際通り',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (481,467,1,'キャプテンズイン 国際通り店','牛排/烤魚','17:00~23:00（LO 22:30）','¥3,000~','可預約（098-868-4670）',NULL,'鐵板燒牛排＆海鮮，主廚現場料理秀，深夜 23:00 仍營業','深夜仍營業適合晚歸',4,'キャプテンズイン 国際通り店 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (482,467,2,'すばやー 松山店','當地特色','21:00~翌5:00','¥700~','不需訂位',NULL,'深夜21時才開門的老字號沖縄麵，飲酒後收尾首選','九點半後才開門剛好接上',4.1,'すばやー 松山店 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (483,470,0,'焼肉なべしま ライカム店','燒肉','11:00~23:00','¥2,500~','電話預約 098-923-5529',NULL,'九州鹿兒島名店沖繩唯一分店，現切現烤搭配秘傳味噌燒肉醬','午間套餐比晚餐划算',4,'焼肉なべしま イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (484,470,1,'炭焼ハラミステーキ 牛米衛','牛排/烤魚','10:00~22:00','¥1,800~','不需訂位',NULL,'炭火燒烤宮崎牛，ライカム人氣最高餐廳之一','用餐尖峰需排隊',3.9,'炭焼ハラミステーキ 牛米衛 イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (485,470,2,'タコライスcafe きじむなぁ ライカム店','當地特色','10:00~22:00','¥780~','不需訂位',NULL,'沖繩人氣塔可飯專賣，招牌蛋包塔可飯「オムタコ」','必點蛋包塔可飯',4,'タコライスcafe きじむなぁ ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (486,472,0,'焼肉レストラン ROINS 久茂地国際通り店','燒肉','17:00~24:00（LO 23:00）','¥3,000~','可預約（098-943-9129）',NULL,'嚴選和牛燒肉，琉球風開放式露台座位，深夜 24:00 仍營業','露台座位氣氛佳',4.3,'焼肉レストラン ROINS 久茂地国際通り店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (487,472,1,'鉄板焼ステーキレストラン 碧 国際通り松尾店','牛排/烤魚','17:00~22:00（LO 20:00）','¥3,000~','一休.com 線上預約','https://restaurant.ikyu.com/124958','全女性主廚鐵板燒，嚴選沖繩縣產黑毛和牛 A3~A5 等級','LO 20:00注意別太晚到',4.2,'鉄板焼ステーキレストラン 碧 国際通り松尾店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (488,472,2,'ゆうなんぎい','當地特色','17:30~22:30（LO 22:00）','¥1,500~','建議預約（098-867-3765）',NULL,'1970 年創業老舖，沖繩鄉土料理名店，必點ラフテー・ゴーヤーチャンプルー','必點ラフテー滷五花',4.3,'ゆうなんぎい 那覇 久茂地',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (489,476,0,'OK STEAK × HAMBURG iias豊崎店','燒肉','10:00~21:00','¥1,000~','不需訂位',NULL,'精肉店直營，石垣牛・沖繩縣產黑毛和牛，300g 牛排 ¥1,100 起','千元牛排CP值極高',4.2,'OK STEAK × HAMBURG iias沖縄豊崎店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (490,476,1,'SAM''S ANCHOR INN iias豊崎店','牛排/烤魚','11:00~22:00（LO 21:00）','¥2,000~','可預約（098-856-3535）',NULL,'海景鐵板燒牛排＆海鮮，主廚桌邊料理秀','靠窗座位可看海景',4.1,'SAM''S ANCHOR INN イーアス沖縄豊崎店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (491,476,2,'親父のまぐろ iias豊崎店','當地特色','11:00~21:00','¥1,050~','不需訂位',NULL,'沖繩近海天然生鮪專門店，當日新鮮處理','生魚片丼飯新鮮又便宜',4,'親父のまぐろ iias豊崎店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (492,477,0,'我那覇豚肉店 カフーナ旭橋店','燒肉','平日 12:00~14:30, 17:00~22:00／假日 12:00~22:00','¥3,000~','電話預約 098-917-2789',NULL,'自家牧場直送阿古豬，旭橋站直結，涮涮鍋與燒肉皆可','旭橋站直結不用走遠',4,'我那覇豚肉店 カフーナ旭橋店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (493,477,1,'ステーキハウス88 辻本店','牛排/烤魚','11:00~翌2:00','¥2,000~','不需訂位',NULL,'1955 年創業沖繩最老牌牛排館，營業至深夜 2 點','深夜營業適合晚歸',4.1,'ステーキハウス88 辻本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (494,477,2,'琉球家庭料理 葵屋 旭橋駅前店','當地特色','15:00~22:00（週四定休）','¥2,000~','可預約',NULL,'每日島唄現場演奏，供應縣產和牛、海葡萄、炒苦瓜','有島唄現場演奏',4,'琉球家庭料理 葵屋 旭橋駅前',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (495,480,0,'空港食堂','燒肉','09:00~20:00','¥600~','不需預約',NULL,'隱藏版員工食堂，在地人也愛吃，CP值超高','一樓角落不顯眼要找',4.1,'空港食堂 那覇空港',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (496,480,1,'天龍 那覇空港店','牛排/烤魚','07:00~20:30','¥800~','不需預約',NULL,'沖繩そば＆定食老店，機場人氣名店','早上七點就開適合趕飛機',3.9,'天龍 那覇空港店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (497,480,2,'A&W 那覇空港店','當地特色','06:30~20:30','¥600~','不需預約',NULL,'沖繩限定美式漢堡，根啤酒 Root Beer 必喝','根啤酒可免費續杯',4,'A&W 那覇空港店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (753,722,0,'ミナミノカフェ（Minamino Cafe）','早餐・咖啡','平日 07:00~15:30／週末 06:00~16:00','¥800~','{"available":"no","recommended":false}',NULL,'ミナミノカフェ — 北谷美浜 American Village 高級食パン專賣咖啡廳，吐司三明治與手工麵包早餐','美浜最早開門的咖啡廳，高級吐司必點；從北谷出發前往殘波岬方向順路',4.2,'ミナミノカフェ 北谷',NULL,'user');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (754,724,0,'花織そば','沖繩料理','11:00~16:00（售完即止）','¥700~','{"available":"no","recommended":false}',NULL,'はなういそば — 読谷村代表性沖繩麵，豚骨柴魚湯頭清爽回甘，自家製麵條Q彈有勁，在地人推薦名店','售完即止建議11點前到',4.2,'花織そば 読谷村',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (755,724,0,'海人食堂','海鮮','11:00~16:00（售完即止）','¥800~','{"available":"no","recommended":false}',NULL,'都屋漁港直營食堂 — 毎朝漁港直送鮮魚，海鮮丼・刺身定食CP值極高，漁港氛圍滿點','漁港直營新鮮度最高',4.1,'海人食堂 読谷都屋漁港',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (756,724,0,'琉球窯 残波岬店','甜點','10:00~18:00','¥500~','{"available":"no","recommended":false}',NULL,'琉球窯 — 殘波岬入口處人氣甜點店，現烤紅芋塔與黑糖霜淇淋，觀光後休憩好去處','現烤紅芋塔是招牌',4,'琉球窯 残波岬店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (757,726,0,'なかむらそば','沖繩料理','10:30~16:00（週四公休）','¥700~','{"available":"no","recommended":false}',NULL,'なかむらそば — 恩納村瀬良垣の老舗沖繩麵，自家製麵條Q彈有勁，招牌アーサそば海藻風味獨特，海景座位一流','海景座位氣氛一流',4.2,'なかむらそば 恩納村','206 314 302*50','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (758,726,0,'ステーキハウス88 恩納店','海鮮','11:00~22:00（年中無休）','¥1,800~','{"available":"no","recommended":false}',NULL,'STEAK HOUSE 88 恩納店 — 創業60年沖繩代表性牛排老店，從平價紅肉到縣產和牛一應俱全，前兼久漁港直送海葡萄鮮度抜群','60年老店牛排品質穩定',4,'ステーキハウス88 恩納店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (759,726,0,'ラーメン暖暮 北谷店','甜點','11:00~翌02:00','¥750~','{"available":"no","recommended":false}',NULL,'ラーメン暖暮 北谷店 — 博多系豚骨拉麵名店，湯頭濃醇順口，読谷/恩納往美國村途中必吃','營業到凌晨適合當宵夜',3.9,'暖暮 北谷店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (760,729,0,'海の家','沖繩料理','17:00~23:00','¥2,000~','{"available":"yes","method":"phone","phone":"098-966-2180","recommended":true}',NULL,'リゾートダイニング 海の家 — 恩納村海景餐廳，沖繩料理與海鮮創作料理，夕陽景觀一流','建議電話預約海景座位',4,'海の家 恩納村',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (761,729,0,'琉球の牛 恩納店','海鮮','17:00~22:30','¥5,000~','{"available":"yes","method":"website","url":"https://www.tablecheck.com/en/shops/yakiniku-onna/reserve","recommended":true}',NULL,'琉球の牛 — 沖繩縣產和牛燒肉，海景包廂','超人氣務必提前網路訂位',4.4,'琉球の牛 恩納店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (762,729,0,'麺処 じゅん坊 恩納店','甜點','11:00~24:00（週四公休）','¥850~','{"available":"no","recommended":false}',NULL,'麺処 じゅん坊 — 恩納村人氣拉麵店，濃厚豚骨醬油湯底，加麵不加價，晚餐後宵夜佳選','加麵不加價很划算',3.8,'麺処 じゅん坊 恩納村',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (763,733,0,'ポークたまごおにぎり本店 牧志市場本店','沖繩料理','07:00~17:30','¥350~',NULL,NULL,'沖繩名物豬肉蛋飯糰排隊名店，現點現做。**ポーたま（豬肉蛋飯糰）**有十幾種口味，推薦原味與油味噌口味，外帶方便適合出發前快速解決','07:00 開門，建議提早到避免排隊',4.4,'ポークたまごおにぎり本店 牧志市場',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (764,733,0,'いちぎん食堂','食堂','24小時','¥600~',NULL,NULL,'松山在地24小時食堂，**ゴーヤーチャンプルー定食**、**沖繩そば**等沖繩家庭早餐，感受在地人的日常','24小時營業，清晨也能吃到熱食',3.8,'いちぎん食堂 那覇松山',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (765,733,0,'三笠食堂','食堂','24小時','¥550~',NULL,NULL,'松山另一間24小時在地食堂，**沖繩ちゃんぽん**（什錦炒飯配蛋）是招牌，份量大CP值高','24小時營業，在地人愛去的老店',3.7,'三笠食堂 那覇松山',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (766,736,0,'我部祖河食堂 浦添店','沖繩料理','11:00~20:00（售完即止，週三公休）','¥750~','{"available":"no","recommended":false}',NULL,'我部祖河食堂 — 60年老字號，招牌軟骨そば（軟骨排骨沖繩麵）湯頭清香，最具代表性沖繩在地風味','售完即止建議早點到',4.2,'我部祖河食堂 浦添店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (767,736,0,'琉球新麺 通堂 PARCO CITY店','海鮮','11:00~22:00','¥780~','{"available":"no","recommended":false}',NULL,'琉球新麺 通堂 — 沖繩本土拉麵名店，濃厚豚骨湯底搭配特製捲麵，PARCO CITY 3F 排隊人氣店','PARCO CITY 3F人氣排隊店',4,'サンエー浦添西海岸パルコシティ 3F','33 394 819*12','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (768,736,0,'敘敘苑 沖繩浦添PARCO CITY店','甜點','11:00~21:00（午餐 11:00~15:00）','¥2,400~','{"available":"yes","method":"website","url":"https://booking.resty.jp/webrsv/search/s014005101/19787","recommended":true}',NULL,'叙々苑 沖縄浦添パルコシティ店 — 高級燒肉午餐','午餐套餐較划算建議訂位',4.3,'サンエー浦添西海岸パルコシティ','33 394 819*12','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (769,738,0,'グルメ迴轉壽司市場 美浜店','沖繩料理','11:00~22:00（全年無休）','¥1,200~','{"available":"no","recommended":false}',NULL,'グルメ迴轉壽司市場 — 美國村人氣迴轉壽司，沖繩在地魚料，海葡萄壽司、石垣牛壽司為招牌，一盤最低110日圓超划算','先抽號碼牌再逛美國村',4,'グルメ迴轉壽司市場 美浜店','33 556 625*14','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (770,738,0,'浜屋沖繩麵 北谷店','海鮮','10:30~20:30（售完即止）','¥700~','{"available":"no","recommended":false}',NULL,'浜屋そば — 北谷地區在地人氣沖繩麵，豚骨高湯清香，搭配在地新鮮食材，店內也有海鮮定食','售完即止建議早點去',4.2,'浜屋そば 北谷',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (771,738,0,'Blue Seal Ice Cream 北谷美浜店','甜點','11:00~22:00','¥450~','{"available":"no","recommended":false}',NULL,'Blue Seal — 沖繩代表性冰淇淋品牌，鹽金楚糕、芒果、紫芋等沖限定口味，美國村散步必吃','沖繩限定口味必吃',4.4,'Blue Seal アメリカンビレッジ店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (772,738,0,'タコライスcafé きじむなぁ 美浜店','沖繩料理','11:00~22:00','¥600~','{"available":"no","recommended":false}',NULL,'タコライスcafé きじむなぁ — 沖繩發源的塔可飯名店，起司蛋塔可飯為招牌，份量十足小孩也愛吃，美國村內步行可達','起司蛋塔可飯最人氣',4,'タコライスcafé きじむなぁ 美浜店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (773,738,0,'ステーキハウス88 北谷店','沖繩料理','11:00~22:00（L.O. 21:30）','¥1,500~','{"available":"no","recommended":false}',NULL,'ステーキハウス88 — 沖繩老字號牛排館，200g テンダーロインステーキ搭配鐵板蒜片，沖繩牛排文化代表','沖繩牛排文化必體驗，CP值高',4.1,'ステーキハウス88 北谷店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (774,738,0,'Transit Café','海鮮','11:00~21:00（週公休）','¥1,000~','{"available":"no","recommended":false}',NULL,'Transit Café — 北谷海邊景觀餐廳，落日海景配西式料理，漢堡排與海鮮義大利麵人氣高，適合親子悠閒用餐','海景座位建議提早到，日落時段超美',4.2,'Transit Café 北谷',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (775,741,0,'パン屋 水円','烘焙坊','08:00~17:00（週三四公休）','¥400~',NULL,NULL,'恩納海岸旁人氣天然酵母麵包坊，每日限量手作。**クロワッサン**酥脆多層，**明太子法國麵包**鹹香可口','08:00 開門現烤出爐，建議開門就到',4.3,'パン屋水円 恩納',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (776,741,0,'シーサイドドライブイン','美式餐廳','08:00~01:00','¥700~',NULL,NULL,'1967年創業沖繩老字號路邊餐廳，**アメリカンブレックファスト**（美式早餐）與招牌**スープ**是幾代沖繩人的回憶','恩納58號線沿線，開車順路',3.8,'シーサイドドライブイン 恩納',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (777,741,0,'A&W 名護店','美式速食','07:00~23:00','¥500~',NULL,NULL,'沖繩限定美式速食，**モーニングセット**（早餐套餐）搭配根啤酒 Root Beer，前往名護鳳梨園途中順路','07:00 開門，名護方向順路可停',3.9,'A&W 名護店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (778,743,0,'百年古家 大家','沖繩料理・阿古豬','午 11:00~15:30／晚 17:30~21:00','¥1,000~','{"available":"yes","method":"website","url":"https://www.tablecheck.com/en/shops/ufuya/reserve","recommended":true}',NULL,'百年古家 大家 うふやー — 百年古民家餐廳，阿古豬套餐、沖繩在地料理，潺潺流水庭園用餐氛圍一流','週末常排隊建議網路訂位',4.1,'百年古家 大家','206 620 592*27','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (779,743,0,'ラーメン太陽 名護店','海鮮','11:00~21:00（週二公休）','¥700~','{"available":"no","recommended":false}',NULL,'ラーメン太陽 — 沖繩名護表性豚骨醬油拉麵，清爽不油膩的沖繩在地風味，附炒飯半份超值','附炒飯半份超值',4,'ラーメン太陽 名護店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (780,743,0,'焼肉 てるりん 名護店','甜點','11:30~14:30／17:00~22:00（週二公休）','¥1,800~','{"available":"yes","method":"phone","phone":"0980-53-0066","recommended":true}',NULL,'焼肉 てるりん — 名護在地人氣炭火燒肉，縣產牛與山原豬組合套餐，午餐優惠划算','午餐套餐CP值高',4.1,'焼肉 てるりん 名護',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (781,748,0,'島豚七輪燒 滿味','沖繩料理','17:00~23:00（週二、三公休）','¥1,500~','{"available":"yes","method":"website","url":"https://manmi-yanbaru.com/contact/","recommended":true}',NULL,'島豚七輪焼 満味 — 名護在地炭火燒肉，主打山原島豚（阿古豬血統），沖繩最具代表性豬肉品種，有中文菜單','超人氣建議提前預約',4.5,'島豚七輪焼 満味 名護',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (782,748,0,'海鮮居食屋 活','海鮮','18:00~23:30（週三公休）','¥3,000~','{"available":"yes","method":"phone","phone":"0980-54-5087","recommended":true}',NULL,'海鮮居食屋 活（かつ）— 名護漁港直送鮮魚，店內活魚水槽可自選食材、指定料理方式，刺身盛合、海鮮丼、沖繩鄉土料理皆備，價格實惠','可自選活魚指定料理方式',4.1,'海鮮居食屋 活 名護',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (783,748,0,'ひがし食堂','甜點','11:00~18:00（年中無休）','¥300~','{"available":"no","recommended":false}',NULL,'ひがし食堂 — 1973年創業名護老舖，招牌「ミルクぜんざい」以綿密刨冰搭配金時豆與煉乳，50年人氣不墜，適合午後甜點','招牌刨冰必吃。18點打烊',4.4,'ひがし食堂 名護',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (784,750,0,'Hawaiian Pancakes House Paanilani','早午餐','08:00~16:00','¥1,000~',NULL,NULL,'恩納村人氣夏威夷風鬆餅店，招牌**マカダミアナッツソースパンケーキ**堆疊超療癒，搭配新鮮水果','人氣店建議 08:00 開門前到',4.1,'Hawaiian Pancakes House Paanilani 恩納',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (785,750,0,'シーサイドドライブイン','美式餐廳','08:00~01:00','¥700~',NULL,NULL,'Day 4 沒去的話推薦嘗試，或再訪點不同品項。**ドライブインカレー**也很受歡迎','前一天如已去過可跳過',3.8,'シーサイドドライブイン 恩納',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (786,750,0,'パン屋 水円','烘焙坊','08:00~17:00（週三四公休）','¥400~',NULL,NULL,'Day 4 沒去的話必訪，每日麵包品項不同可以兩天都去嘗鮮','每日限量，賣完就沒了',4.3,'パン屋水円 恩納',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (787,753,0,'琉球回転寿司 海來 ライカム店','沖繩料理','11:00~22:00','¥1,200~','{"available":"no","recommended":false}',NULL,'沖繩在地迴轉壽司，新鮮縣產魚料','沖繩在地魚料新鮮實惠',3.7,'琉球回転寿司 海來 ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (788,753,0,'一蘭拉麵 ライカム店','海鮮','10:00~22:00','¥980~','{"available":"no","recommended":false}',NULL,'天然豚骨拉麵，專注個人用餐空間','個人隔間座位不用排隊',3.9,'一蘭 イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (789,753,0,'A&W ライカム店','甜點','09:00~22:00','¥700~','{"available":"no","recommended":false}',NULL,'沖繩限定美式速食，根啤酒 Root Beer 必喝','根啤酒免費續杯必喝',3.9,'A&W イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (790,756,0,'花笠食堂','沖繩料理','11:00~20:00（週日公休）','¥700~','{"available":"no","recommended":false}',NULL,'花笠食堂 — 那霸牧志市場旁百年老店，沖繩日常家庭料理，炒苦瓜（ゴーヤーチャンプルー）與紅燒豬腳最具代表','週日公休請注意',3.9,'花笠食堂 那覇','33 157 208*63','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (791,756,0,'ちょこっと寿し 国際通り牧志店','海鮮','12:00~24:00（週三公休）','¥2,000~','{"available":"no","recommended":false}',NULL,'ちょこっと寿し — 北海道×沖繩雙產地直送鮮魚壽司，沖繩三大高級魚赤仁ミーバイ・赤マチ必點，一貫69日圓起CP值高','一貫69日圓起CP值高',4,'ちょこっと寿し 国際通り牧志店','33 157 323*00','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (792,756,0,'焼肉もとぶ牧場 那覇店','甜點','17:00~22:00（L.O 21:30）','¥4,200~','{"available":"yes","method":"website","url":"https://www.tablecheck.com/en/shops/motobu-farm-naha/reserve","recommended":true}',NULL,'焼肉もとぶ牧場 — 沖繩品牌「もとぶ牛」牧場直營燒肉，農林水産大臣賞受賞和牛，個室包廂','建議提前網路訂位',4.3,'焼肉もとぶ牧場 那覇店','33 156 170*03','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (793,756,0,'焼肉ここから 那覇久茂地店','燒肉','17:00~03:00（週日~24:00）','¥3,000~','{"available":"yes","method":"phone","recommended":true}',NULL,'焼肉ここから — 主打厚切燒肉，招牌「伝説盛り」厚切牛舌・橫隔膜・菲力三拼，深夜三點仍可入座的那霸人氣燒肉店','深夜營業至凌晨3點，適合晚歸',4,'焼肉ここから 那覇久茂地店',NULL,'user');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (794,756,0,'串焼きダイニング ウグイス','居酒屋','17:30~24:00（週四公休）','¥2,000~','{"available":"yes","method":"website","recommended":true}',NULL,'串焼きダイニング ウグイス — 使用沖繩縣產山原雞與阿古豬的炭火串燒，食材產地直送鎖住肉汁精華，國際通附近地點便利','週四公休，位於國際通旁松尾',3.8,'串焼きダイニング ウグイス 那覇',NULL,'user');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (795,756,0,'あぐーの隠れ家 富着店','阿古豬涮涮鍋','17:00~22:30（L.O 22:00）','¥3,000~',NULL,NULL,NULL,'恩納村富著，離國際通較遠約40分鐘車程；提供涮涮鍋、壽喜燒、蒸籠、鐵板四種吃法',4.1,'あぐーの隠れ家 富着店','206 221 372*23','user');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (796,760,0,'C&C BREAKFAST OKINAWA','早午餐','09:00~15:00（不定休）','¥1,200~',NULL,NULL,'那覇最受歡迎的早午餐名店，**厚鬆餅**與**班尼迪克蛋**必點，店內裝潢溫馨可愛','09:00 開門，若要前往需將出發時間延後約1小時',4.3,'C&C BREAKFAST OKINAWA 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (797,760,0,'ポークたまごおにぎり本店 牧志市場本店','沖繩料理','07:00~17:30','¥350~',NULL,NULL,'Day 2 沒去的話今嘗！沖繩名物豬肉蛋飯糰，買了邊走邊吃前往牧志市場','牧志市場就在旁邊，早餐順路',4.4,'ポークたまごおにぎり本店 牧志市場',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (798,760,0,'いちぎん食堂','食堂','24小時','¥600~',NULL,NULL,'Day 2 沒去的話推薦嘗試。24小時營業的在地食堂，沖繩家庭料理早餐','24小時營業，想幾點去都可以',3.8,'いちぎん食堂 那覇松山',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (799,763,0,'カフェくるくま','南洋料理','10:00~20:00（10~3月至18:00）','¥1,200~','{"available":"no","recommended":false}',NULL,'南城知名海景咖啡廳，招牌**泰式綠咖哩**香濃入味，**印度烤雞餐**也是人氣選項。露台座位可俯瞰太平洋，天氣好時視野遼闊','露台座位最搶手，平日好入座',4.1,'カフェくるくま 南城','232 562 891*11','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (800,763,0,'浜辺の茶屋','咖啡輕食','10:00~20:00（週一至14:00）','¥900~','{"available":"no","recommended":false}',NULL,'建在海邊懸崖上的絕景茶屋，滿潮時海水就在腳下。**法式吐司**和**手作蛋糕**是招牌，適合輕食午餐','滿潮時海水在腳下，景色最美',4.2,'浜辺の茶屋 南城','232 469 491*25','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (801,763,0,'山の茶屋・楽水','沖繩料理','11:00~16:00（週四公休）','¥1,000~','{"available":"no","recommended":false}',NULL,'浜辺の茶屋姐妹店，山坡上的隱藏版食堂。使用沖繩在地食材的**島野菜定食**和**自家製麵**，健康清爽','浜辺の茶屋旁山坡上，可兩間一起逛',4,'山の茶屋 楽水 南城','232 469 580*33','ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (802,768,0,'ステーキハウス88 辻本店','牛排','11:00~22:00（L.O 21:30）','¥1,500~','{"available":"no","recommended":false}',NULL,'1955年創業的沖繩老牌牛排店，**200g テンダーロインステーキ** ¥1,800 起跳，附沙拉、湯、麵包。在地人與觀光客都愛的超值牛排','那覇辻地區，距飯店步行約15分鐘',4,'ステーキハウス88 辻本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (803,768,0,'Jack''s Steak House','牛排','11:00~翌01:00','¥1,500~','{"available":"no","recommended":false}',NULL,'1953年創業，沖繩最古老的牛排店。美式風格 **L-bone Steak** 與 **Tenderloin** 是招牌，搭配獨家醬汁風味絕佳','那覇市西，距飯店步行約20分鐘（或計程車約7分鐘），營業到凌晨1點',4.1,'ジャッキーステーキハウス 那覇',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (804,768,0,'琉球新麺 通堂 小禄本店','拉麵','11:00~翌03:00','¥800~','{"available":"no","recommended":false}',NULL,'沖繩人氣拉麵名店，招牌**男味**（豚骨醬油）與**女味**（豚骨鹽味）各有粉絲。湯頭濃郁不膩，麵條Q彈有嚼勁','小禄站旁，距飯店搭計程車約10分鐘（或單軌壺川站→小禄站1站），營業到凌晨3點',4,'琉球新麺 通堂 小禄本店',NULL,'ai');
INSERT OR IGNORE INTO restaurants (id,entry_id,sort_order,name,category,hours,price,reservation,reservation_url,description,note,rating,maps,mapcode,source) VALUES (805,736,1,'極味屋 沖縄パルコシティ店','洋食','11:00~22:00','¥1,200~','{"available":"no","recommended":false}',NULL,'極味屋 — 博多發祥の鉄板漢堡排名店，特色是自己在鐵板上煎半熟漢堡排，外焦內嫩肉汁四溢。**伊萬里牛漢堡排**為招牌，搭配多種醬料自由搭配，小孩也能享受DIY樂趣','PARCO CITY 3F，自己煎漢堡排小孩會很開心',4.2,'極味屋 沖縄パルコシティ店','33 394 819*12','user');

-- shopping (pre-POI migration)
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (67,'entry',193,0,'板橋大遠百','購物中心','11:00~22:00','B1美食街伴手禮, 9F餐廳街, 頂樓空中花園限定商品','地下連通捷運站很方便',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (68,'entry',193,1,'環球購物中心 板橋車站店','購物中心','11:00~22:00','B2美食廣場, 生活雜貨樓層, 4F親子童裝特賣','與板橋車站共構',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (69,'entry',193,2,'板橋車站地下街','購物中心','10:00~22:00','平價服飾, 在地小吃, 流行飾品配件','平價挖寶好去處',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (70,'entry',206,0,'新莊廟街商圈','伴手禮','10:00~21:00','老順香鹹光餅, 傳統糕餅, 廟口現做米製品','鹹光餅是新莊名產必買',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (71,'entry',206,1,'新莊夜市','伴手禮','17:00~00:00','鹽酥雞, 豆花, 車輪餅','傍晚後才開始營業',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (72,'entry',206,2,'宏匯廣場 新莊副都心','購物中心','11:00~22:00','影城, 美食街, 頂樓空中廣場季節活動','有影城可順便看電影',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (73,'entry',206,3,'唐吉軻德 新莊幸福店','唐吉軻德','10:00~02:00','日本進口零食與餅乾, 美妝保養特價品, 生活雜貨與廚房用品','營業到凌晨2點很方便',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (74,'entry',218,0,'中和環球購物中心','購物中心','11:00~22:00','美食街, 生活用品, 頂樓休閒娛樂設施','與捷運站共構交通便利',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (75,'entry',218,1,'家樂福 中和店','超市','08:00~23:00','零食伴手禮, 生鮮食材, 台灣特產禮盒','營業到23點適合晚上逛',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (76,'entry',218,2,'景安捷運站商圈','購物中心','10:00~22:00','平價服飾, 流行飾品, 韓系美妝小舖','捷運站出口即到',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (77,'entry',229,0,'樹林興仁花園夜市','伴手禮','17:00~00:00（三五六日）','遊戲區獎品, 服飾攤位, 現炸雞排與臭豆腐','僅週三五六日營業',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (78,'entry',229,1,'日月光廣場 土城店','購物中心','11:00~22:00','平價生活百貨, 餐廳美食, 超商聯名限定商品','平價百貨適合隨意逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (79,'entry',229,2,'全聯 樹林中山店','超市','08:00~23:00','在地零食, 生鮮食材, PX自有品牌熟食便當','營業到23點方便補貨',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (80,'entry',234,0,'淡水老街商圈','伴手禮','10:00~21:00','阿給, 魚酥, 鐵蛋','假日人潮多建議平日去',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (81,'entry',234,1,'淡水漁人碼頭商圈','伴手禮','10:00~21:00','手作紀念品, 河景咖啡, 情人橋周邊限定伴手禮','傍晚看夕陽最美',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (82,'entry',234,2,'八里左岸商圈','伴手禮','10:00~19:00','雙胞胎, 孔雀蛤, 福州餅','搭渡輪過去更有趣',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (83,'hotel',58,0,'CU 南浦洞店','超商','24小時','香蕉牛奶, 三角飯糰, 韓國燒酒','飯店旁最近的便利商店',3.8,'CU 남포동점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (84,'hotel',58,1,'Olive Young 光復路店','藥妝','10:00~22:00','防曬乳, 面膜, 護唇膏','光復路上最大間的分店',4.3,'올리브영 광복점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (85,'hotel',58,2,'Homeplus Express 南浦店','超市','09:00~24:00','韓國泡麵, 海苔, 辣炒年糕醬','採買零食伴手禮的好選擇',3.9,'홈플러스 익스프레스 남포점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (86,'entry',254,0,'樂天百貨 西面店','購物中心','10:30~20:00','韓國美妝品牌, 樂天免稅商品, 韓國零食伴手禮','持護照可領折扣券',4.2,'롯데백화점 서면점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (87,'entry',254,1,'Olive Young 西面站店','藥妝','10:00~23:00','韓國面膜, 防曬乳, 美妝小物','營業到23點。晚上逛也行',4.3,'올리브영 서면역점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (88,'entry',254,2,'GS25 西面站店','超商','24小時','香蕉牛奶, 韓國啤酒, 三角飯糰','地鐵站出口旁很方便',3.8,'GS25 서면역점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (89,'hotel',59,0,'CU 南浦洞店','超商','24小時','香蕉牛奶, 三角飯糰, 韓國燒酒','飯店旁最近的便利商店',3.8,'CU 남포동점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (90,'hotel',59,1,'Olive Young 光復路店','藥妝','10:00~22:00','防曬乳, 面膜, 護唇膏','光復路上最大間的分店',4.3,'올리브영 광복점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (91,'hotel',59,2,'Homeplus Express 南浦店','超市','09:00~24:00','韓國泡麵, 海苔, 辣炒年糕醬','採買零食伴手禮的好選擇',3.9,'홈플러스 익스프레스 남포점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (92,'entry',258,0,'國際市場伴手禮街','伴手禮','09:00~20:00','韓國海苔, 人蔘糖, 韓國辣椒醬','可議價。多比幾攤再買',4.2,'국제시장 기념품',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (93,'entry',258,1,'GS25 國際市場店','超商','24小時','香蕉牛奶, 韓國零食, 即沖咖啡','市場內唯一便利商店',3.8,'GS25 국제시장점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (94,'entry',258,2,'Olive Young 南浦洞店','藥妝','10:00~22:00','韓國美妝, 蝸牛面膜, BB霜','南浦洞最大間的藥妝店',4.3,'올리브영 남포동점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (95,'hotel',60,0,'CU 南浦洞店','超商','24小時','香蕉牛奶, 三角飯糰, 韓國燒酒','飯店旁最近的便利商店',3.8,'CU 남포동점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (96,'hotel',60,1,'Olive Young 光復路店','藥妝','10:00~22:00','防曬乳, 面膜, 護唇膏','光復路上最大間的分店',4.3,'올리브영 광복점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (97,'hotel',60,2,'Homeplus Express 南浦店','超市','09:00~24:00','韓國泡麵, 海苔, 辣炒年糕醬','採買零食伴手禮的好選擇',3.9,'홈플러스 익스프레스 남포점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (98,'hotel',61,0,'CU 南浦洞店','超商','24小時','香蕉牛奶, 三角飯糰, 韓國燒酒','飯店旁最近的便利商店',3.8,'CU 남포동점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (99,'hotel',61,1,'Olive Young 光復路店','藥妝','10:00~22:00','防曬乳, 面膜, 護唇膏','光復路上最大間的分店',4.3,'올리브영 광복점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (100,'hotel',61,2,'Homeplus Express 南浦店','超市','09:00~24:00','韓國泡麵, 海苔, 辣炒年糕醬','採買零食伴手禮的好選擇',3.9,'홈플러스 익스프레스 남포점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (101,'entry',271,0,'emart 釜山站店','超市','10:00~23:00','韓國泡麵（辛拉麵、三養火雞麵）, 韓國海苔, 韓國辣椒醬','出示護照可退稅',4.1,'이마트 부산역점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (102,'entry',271,1,'Lotte Mart 釜山站店','超市','10:00~23:00','樂天巧克力派, Market O 布朗尼, 韓國燒酒禮盒','與 emart 相鄰可比價',4,'롯데마트 부산역점',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (103,'entry',271,2,'三進魚板體驗館','伴手禮','10:00~20:00','釜山魚板禮盒, 魚板可樂餅, 魚板冰棒','釜山必買伴手禮。可試吃',4.6,'삼진어묵체험관',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (104,'hotel',62,0,'FamilyMart 御池麩屋町店','超商','24小時','京都限定八ツ橋, 抹茶甜點, おにぎり','步行1分鐘即達',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (105,'hotel',62,1,'FRESCO 御池店','超市','09:00~23:00','京漬物, 京都地酒, 季節水果','晚間有折扣標籤',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (106,'hotel',62,2,'ドン・キホーテ 京都河原町店','唐吉軻德','10:00~翌5:00','藥妝, 零食, 京都限定伴手禮','免稅櫃台在1F',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (107,'entry',286,0,'BAL','購物中心','11:00~20:00','設計師品牌, 選物店, 生活雜貨','地下樓層有選物店',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (108,'entry',286,1,'Loft 河原町店','購物中心','11:00~21:00','文具, 生活雜貨, 京都限定商品','文具控必逛',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (109,'entry',286,2,'ARTS&SCIENCE KYOTO','伴手禮','12:00~19:00','皮件, 飾品, 生活用品','町家風格空間很美',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (110,'hotel',63,0,'FamilyMart 御池麩屋町店','超商','24小時','京都限定八ツ橋, 抹茶甜點, おにぎり','步行1分鐘即達',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (111,'hotel',63,1,'FRESCO 御池店','超市','09:00~23:00','京漬物, 京都地酒, 季節水果','晚間有折扣標籤',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (112,'hotel',63,2,'ドン・キホーテ 京都河原町店','唐吉軻德','10:00~翌5:00','藥妝, 零食, 京都限定伴手禮','免稅櫃台在1F',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (113,'hotel',64,0,'FamilyMart 御池麩屋町店','超商','24小時','京都限定八ツ橋, 抹茶甜點, おにぎり','步行1分鐘即達',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (114,'hotel',64,1,'FRESCO 御池店','超市','09:00~23:00','京漬物, 京都地酒, 季節水果','晚間有折扣標籤',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (115,'hotel',64,2,'ドン・キホーテ 京都河原町店','唐吉軻德','10:00~翌5:00','藥妝, 零食, 京都限定伴手禮','免稅櫃台在1F',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (116,'hotel',65,0,'FamilyMart 御池麩屋町店','超商','24小時','京都限定八ツ橋, 抹茶甜點, おにぎり','步行1分鐘即達',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (117,'hotel',65,1,'FRESCO 御池店','超市','09:00~23:00','京漬物, 京都地酒, 季節水果','晚間有折扣標籤',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (118,'hotel',65,2,'ドン・キホーテ 京都河原町店','唐吉軻德','10:00~翌5:00','藥妝, 零食, 京都限定伴手禮','免稅櫃台在1F',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (119,'hotel',66,0,'FamilyMart 御池麩屋町店','超商','24小時','京都限定八ツ橋, 抹茶甜點, おにぎり','步行1分鐘即達',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (120,'hotel',66,1,'FRESCO 御池店','超市','09:00~23:00','京漬物, 京都地酒, 季節水果','晚間有折扣標籤',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (121,'hotel',66,2,'ドン・キホーテ 京都河原町店','唐吉軻德','10:00~翌5:00','藥妝, 零食, 京都限定伴手禮','免稅櫃台在1F',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (122,'hotel',67,0,'FamilyMart 國際通り入口店','超商','24小時','沖繩限定飯糰（豬肉蛋）, 沖繩限定冰淇淋, 便當・輕食','步行1分鐘。24小時營業',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (123,'hotel',67,1,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 島豆腐・海葡萄, 泡盛・Orion 啤酒','品項齊全。在地人愛逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (124,'hotel',67,2,'唐吉軻德 國際通店','唐吉軻德','24小時','沖繩限定紫芋 KitKat・紅芋塔, EVE 止痛藥・合利他命, 安耐曬防曬乳・美妝','免稅且24小時。掃貨首選',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (125,'hotel',68,0,'FamilyMart 國際通り入口店','超商','24小時','沖繩限定飯糰（豬肉蛋）, 沖繩限定冰淇淋, 便當・輕食','步行1分鐘。24小時營業',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (126,'hotel',68,1,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 島豆腐・海葡萄, 泡盛・Orion 啤酒','品項齊全。在地人愛逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (127,'hotel',68,2,'唐吉軻德 國際通店','唐吉軻德','24小時','沖繩限定紫芋 KitKat・紅芋塔, EVE 止痛藥・合利他命, 安耐曬防曬乳・美妝','免稅且24小時。掃貨首選',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (128,'hotel',69,0,'FamilyMart 國際通り入口店','超商','24小時','沖繩限定飯糰（豬肉蛋）, 沖繩限定冰淇淋, 便當・輕食','步行1分鐘。24小時營業',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (129,'hotel',69,1,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 島豆腐・海葡萄, 泡盛・Orion 啤酒','品項齊全。在地人愛逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (130,'hotel',69,2,'唐吉軻德 國際通店','唐吉軻德','24小時','沖繩限定紫芋 KitKat・紅芋塔, EVE 止痛藥・合利他命, 安耐曬防曬乳・美妝','免稅且24小時。掃貨首選',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (131,'hotel',70,0,'FamilyMart 國際通り入口店','超商','24小時','沖繩限定飯糰（豬肉蛋）, 沖繩限定冰淇淋, 便當・輕食','步行1分鐘。24小時營業',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (132,'hotel',70,1,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 島豆腐・海葡萄, 泡盛・Orion 啤酒','品項齊全。在地人愛逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (133,'hotel',70,2,'唐吉軻德 國際通店','唐吉軻德','24小時','沖繩限定紫芋 KitKat・紅芋塔, EVE 止痛藥・合利他命, 安耐曬防曬乳・美妝','免稅且24小時。掃貨首選',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (134,'entry',355,0,'御菓子御殿 讀谷本店','伴手禮','09:00~19:00','紅芋塔（元祖）, 紅芋生塔（冷藏限定）, 黑糖蛋糕','工廠直營。可免費試吃',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (179,'hotel',77,0,'AEON 北谷店','超市','食品區 ~24:00','沖繩限定泡盛, 紅芋塔, 黑糖, Orion 啤酒, 沖繩炸雞（チキン）','步行5分鐘。食品區晚間有折扣',4,'イオン北谷店','33 526 213*28','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (180,'hotel',77,1,'Lawson 北谷美浜店（飯店 1F）','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, 泡麵零食, 飲料','飯店1F直通超方便',3.5,'ローソン 北谷美浜店','33 526 450*63','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (181,'hotel',77,2,'大國藥妝 北谷美國村店','藥妝','10:00~21:00','日本藥妝免稅優惠（滿 ¥5,000）, 護膚保養品, 沖繩限定零食, 消炎止痛貼布','滿¥5,000免稅。記得帶護照',3.9,'大国ドラッグ 北谷アメリカンビレッジ店','33 526 241*20','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (182,'entry',423,0,'唐吉訶德 北谷店','唐吉軻德','24 小時','沖繩限定泡盛系列, 雪鹽洗顏粉, 沖繩黑糖零食, 藥妝免稅商品','24小時營業。深夜人少好逛',4.1,'ドン・キホーテ 北谷店','33 526 241*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (183,'entry',423,1,'AEON 北谷店','超市','食品區 ~24:00','沖繩限定泡盛, 紅芋塔, 黑糖, Orion 啤酒, 沖繩炸雞（チキン）','美國村對面步行3分鐘',4,'イオン北谷店','33 526 084*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (184,'entry',423,2,'大國藥妝 北谷美國村店','藥妝','10:00~21:00','日本藥妝免稅優惠（滿 ¥5,000）, 護膚保養品, 沖繩限定零食, 消炎止痛貼布','21:00關門。建議傍晚前去',3.9,'大国ドラッグ 北谷アメリカンビレッジ店','33 526 241*20','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (185,'hotel',78,0,'AEON 名護店','超市','食品區 ~24:00','沖繩限定泡盛, 名護限定商品, UNIQLO 服飾（便宜）, 黑糖零食, 沖繩味噌','飯店開車5分鐘。有UNIQLO',4,'イオン名護店','206 598 600*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (186,'hotel',78,1,'Lawson 名護宮里店','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, 泡麵零食, 飲料','飯店附近步行可達',3.5,'ローソン名護宮里店','206 598 371*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (187,'hotel',78,2,'FRESH PLAZA UNION 名護店','超市','07:00~24:00','沖繩本地農產品（ゴーヤー、島野菜）, 沖繩限定飲料, 在地便當熟食, 沖繩手工泡麵','在地超市。熟食便當CP值高',3.8,'フレッシュプラザユニオン名護店','206 598 200*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (188,'hotel',79,0,'AEON 名護店','超市','食品區 ~24:00','沖繩限定泡盛, 名護限定商品, UNIQLO 服飾（便宜）, 黑糖零食, 沖繩味噌','連住可晚上再來補貨',4,'イオン名護店','206 598 600*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (189,'hotel',79,1,'Lawson 名護宮里店','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, 泡麵零食, 飲料','24小時。回飯店前可順路買',3.5,'ローソン名護宮里店','206 598 371*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (190,'hotel',79,2,'FRESH PLAZA UNION 名護店','超市','07:00~24:00','沖繩本地農產品（ゴーヤー、島野菜）, 沖繩限定飲料, 在地便當熟食, 沖繩手工泡麵','早上7點開。可買早餐水果',3.8,'フレッシュプラザユニオン名護店','206 598 200*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (191,'hotel',80,0,'UNION 前島店','超市','24 小時','沖繩限定水果（芒果、鳳梨）, HAI-SAI SAUCE 辣醬, 沖繩在地生魚片, UNION 原創 T 恤','24小時營業。在地人愛用超市',3.8,'フレッシュプラザユニオン前島店','33 157 353*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (192,'hotel',80,1,'唐吉訶德 國際通店','唐吉軻德','09:00~翌 03:00','沖繩限定零食, 藥妝（免稅滿 ¥5,500）, 泡盛系列禮盒, 化妝品美容儀器','營業到凌晨3點。晚上人少好逛',4,'ドン・キホーテ国際通り店','33 157 412*76','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (193,'hotel',80,2,'FamilyMart 那霸美榮橋店','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, 泡麵零食, 飲料','飯店旁邊超方便',3.5,'ファミリーマート 那覇美栄橋店','33 157 413*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (194,'entry',443,0,'寶可夢中心 沖繩','購物中心','10:00~22:00','沖繩限定皮卡丘玩偶, 沖繩限定商品（夏威夷風）, 寶可夢文具與日常小物, 限定聯名商品','週六建議開門就到搶限定品',4.3,'ポケモンセンターオキナワ',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (195,'entry',443,1,'KOJIMA×BIC CAMERA 來客夢店','購物中心','10:00~22:00','日本家電（相機、吹風機）, 美容電器（捲髮棒、整髮器）, 免稅優惠（滿 ¥5,000）, 3C 周邊配件','滿¥5,000免稅。帶護照辦退稅',3.9,'KOJIMA×BIC CAMERA イオンモール沖縄ライカム店',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (196,'entry',443,2,'AEON STYLE 超市（3F）','超市','10:00~22:00','沖繩限定食品, Orion 啤酒花生（沖繩限定）, 沖繩黑糖、紅芋零食, 今治毛巾（划算）','3F食品區。伴手禮種類最齊全',4,'イオンスタイル沖縄ライカム',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (197,'entry',445,0,'御菓子御殿 國際通松尾店','伴手禮','09:00~22:00','紅芋塔（¥1,100/10入）, 塩胡麻金楚糕, 紅芋餅乾, 御殿限定禮盒','紅芋塔是沖繩No.1伴手禮。必買：⑧砂糖樹夾心餅乾⭐4.5',4.2,'御菓子御殿 国際通り松尾店','33 157 352*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (198,'entry',445,1,'鹽屋 まーすやー 國際通店','伴手禮','10:00~22:00','宮古島雪鹽, 雪鹽冰淇淋（現場品嚐）, 鹽味白巧克力餅乾, 雪鹽棉花餅','必買：①雪塩夾心餅乾(雪塩さんど)⭐4.5、②雪塩巧克力酥⭐4.5。可現場試吃雪鹽冰淇淋',4.1,'塩屋 国際通り店','33 157 383*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (199,'entry',445,2,'唐吉訶德 國際通店','唐吉軻德','09:00~翌 03:00','沖繩限定零食, 藥妝（免稅滿 ¥5,500）, 泡盛系列禮盒, 化妝品美容儀器','晚餐後再來逛人少。營業到凌晨。必買：⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5',4,'ドン・キホーテ国際通り店','33 157 412*76','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (200,'entry',449,0,'御菓子御殿 國際通松尾店','伴手禮','09:00~22:00','紅芋塔（¥1,100/10入）, 塩胡麻金楚糕, 紅芋餅乾, 御殿限定禮盒','最後採購首選。可試吃再買。必買：⑧砂糖樹夾心餅乾⭐4.5',4.2,'御菓子御殿 国際通り松尾店','33 157 352*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (201,'entry',449,1,'鹽屋 まーすやー 國際通店','伴手禮','10:00~22:00','宮古島雪鹽, 雪鹽冰淇淋（現場品嚐）, 鹽味白巧克力餅乾, 雪鹽棉花餅','必買：①雪塩夾心餅乾(雪塩さんど)⭐4.5、②雪塩巧克力酥⭐4.5。10點才開，雪鹽冰淇淋必吃',4.1,'塩屋 国際通り店','33 157 383*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (202,'entry',449,2,'わしたショップ 國際通本店','伴手禮','09:00~22:00','沖繩物產公社直營限定商品, 泡盛（殘波、久米仙、瑞泉）, 金楚糕禮盒, 沖繩黑糖','沖繩物產公社直營。必買：④石垣島辣油⭐5、⑦沖繩褐藻&苦瓜香鬆⭐4',4,'わしたショップ 国際通り本店','33 157 411*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (203,'entry',449,3,'唐吉訶德 國際通店','唐吉軻德','09:00~翌 03:00','沖繩限定零食, 藥妝（免稅滿 ¥5,500）, 泡盛系列禮盒, 化妝品美容儀器','最後衝刺免稅購物。必買：⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5',4,'ドン・キホーテ 国際通り店','33 157 382*00','ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (204,'entry',449,4,'泡盛專賣（瑞泉酒造など）','伴手禮','依店舖而異，約 10:00~20:00','殘波（残波）泡盛, 久米仙泡盛, 瑞泉古酒, 泡盛糖果禮盒','可試飲再決定。古酒送禮體面',3.9,'瑞泉酒造 国際通り',NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (205,'hotel',81,0,'唐吉軻德那霸店（全球最大旗艦店）','唐吉軻德','24 小時','沖繩限定泡盛, 紅芋塔/紅芋餅乾, Orion 啤酒, 沖繩黑糖, 沖繩限定零食','四樓免稅櫃台較空',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (206,'hotel',81,1,'Lawson 旭橋店','超商','24 小時','沖繩限定冰淇淋（紅芋口味）, 烤地瓜, 飯糰便當, 沖繩限定飲料','飯店步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (207,'hotel',81,2,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 沖繩豆腐（島豆腐）, 泡盛, 海葡萄（海ぶどう）','生鮮區種類最齊全',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (208,'entry',457,0,'辻スーパー','超市','24小時全年無休','現炸沖繩可樂餅、炸雞（現做熟食攤）, 沖繩限定便當・熟食・生鮮食材, ORION 啤酒、泡盛沖繩地酒','熟食攤晚上八點後打折',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (209,'entry',457,1,'FamilyMart・LAWSON（旭橋周邊）','超商','24小時','沖繩限定飯糰（LAWSON 沖繩麵飯糰）, 沖繩限定香檸炸雞（LAWSON）, ATM 換現金・SIM 卡購買','ATM可提日幣現金',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (210,'entry',458,0,'唐吉訶德 國際通店','唐吉軻德','24小時全年無休','EVE 止痛藥・合利他命・眼藥水（旅行必備藥品）, 沖繩限定紫芋 KitKat・黑糖點心・御果子御殿紅芋塔, 安耐曬防曬乳・KOSE 雪肌精・&Honey 護髮品, Royce 生巧克力・薯條三兄弟（北海道名產）','人潮多建議平日去',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (211,'hotel',82,0,'唐吉軻德那霸店（全球最大旗艦店）','唐吉軻德','24 小時','沖繩限定泡盛, 紅芋塔/紅芋餅乾, Orion 啤酒, 沖繩黑糖, 沖繩限定零食','四樓免稅櫃台較空',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (212,'hotel',82,1,'Lawson 旭橋店','超商','24 小時','沖繩限定冰淇淋（紅芋口味）, 烤地瓜, 飯糰便當, 沖繩限定飲料','飯店步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (213,'hotel',82,2,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 沖繩豆腐（島豆腐）, 泡盛, 海葡萄（海ぶどう）','生鮮區種類最齊全',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (214,'hotel',83,0,'唐吉軻德那霸店（全球最大旗艦店）','唐吉軻德','24 小時','沖繩限定泡盛, 紅芋塔/紅芋餅乾, Orion 啤酒, 沖繩黑糖, 沖繩限定零食','四樓免稅櫃台較空',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (215,'hotel',83,1,'Lawson 旭橋店','超商','24 小時','沖繩限定冰淇淋（紅芋口味）, 烤地瓜, 飯糰便當, 沖繩限定飲料','飯店步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (216,'hotel',83,2,'サンエー那霸メインプレイス','超市','09:00~22:00','沖繩本地豬肉（アグー豚）, 沖繩豆腐（島豆腐）, 泡盛, 海葡萄（海ぶどう）','生鮮區種類最齊全',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (217,'hotel',84,0,'FamilyMart 那霸西店','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, Orion 啤酒罐裝, 沖繩限定零食','飯店附近最近的超商',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (218,'hotel',84,1,'むつみ橋かどや（牧志市場附近生鮮超市）','超市','10:00~20:00','海葡萄（海ぶどう）, 沖繩豆腐（島豆腐）, 沖繩海鮮, 沖繩特產調味料','在地人採買的超市',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (219,'hotel',84,2,'ドラッグストアコスモス 那霸泊港店','藥妝','09:00~21:00','日本藥妝免稅優惠, 護膚保養品, 沖繩限定零食, 消炎止痛貼布','價格比國際通便宜',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (220,'entry',470,0,'KOJIMA × BIC CAMERA','購物中心','10:00~22:00','美容家電（吹風機、美容儀）, 相機、耳機、遊戲機, 沖繩限定家電周邊','可免稅且比市區便宜',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (221,'entry',470,1,'AEON STYLE 超市','超市','08:00~23:00','御果子御殿紅芋塔, 石垣島辣油（邊銀食堂）, ORION 啤酒／泡盛沖繩限定, 宮古島雪鹽、金楚糕','伴手禮一次買齊最方便',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (222,'entry',470,2,'寶可夢中心沖繩','伴手禮','10:00~22:00','沖繩限定寶可夢商品, 皮卡丘 × 沖繩設計周邊, 集換式卡牌','沖繩限定款只有這裡有',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (223,'entry',473,0,'唐吉訶德 那霸壺川店','唐吉軻德','08:00~翌3:00','EVE 止痛藥・合利他命・眼藥水（旅行必備藥品）, 沖繩限定零食・紅芋點心・黑糖果子, 安耐曬防曬乳・藥妝保養品（比國際通店更寬敞好逛）','比國際通店人少好逛',4.1,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (224,'entry',473,1,'FamilyMart・LAWSON（那霸西周邊）','超商','24小時','沖繩限定飯糰・沖繩麵飯糰（LAWSON）, 沖繩限定香檸炸雞・在地熟食, 隔日早餐備糧・飲料・零食','可買隔天早餐備糧',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (225,'entry',473,2,'ドラッグイレブン 那霸西店','藥妝','09:00~22:00','沖繩限定 LuLuLun 面膜, ANESSA 安耐曬防曬乳, 龍角散粉包','免稅門檻較低',3.7,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (226,'hotel',85,0,'FamilyMart 那霸西店','超商','24 小時','沖繩限定冰淇淋, 飯糰便當, Orion 啤酒罐裝, 沖繩限定零食','飯店附近最近的超商',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (227,'hotel',85,1,'むつみ橋かどや（牧志市場附近生鮮超市）','超市','10:00~20:00','海葡萄（海ぶどう）, 沖繩豆腐（島豆腐）, 沖繩海鮮, 沖繩特產調味料','在地人採買的超市',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (228,'hotel',85,2,'ドラッグストアコスモス 那霸泊港店','藥妝','09:00~21:00','日本藥妝免稅優惠, 護膚保養品, 沖繩限定零食, 消炎止痛貼布','價格比國際通便宜',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (229,'entry',476,0,'KOJIMA × BIC CAMERA','購物中心','10:00~21:00','家電、相機、電腦周邊, 美容家電（吹風機、美容儀）, 遊戲機、模型周邊','免稅且品項齊全',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (230,'entry',476,1,'札幌藥妝（サツドラ）','藥妝','10:00~21:00','沖繩限定 LuLuLun 面膜, ANESSA 安耐曬防曬乳, 龍角散粉包','藥妝價格比市區實惠',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (231,'entry',476,2,'AEON STYLE 超市','超市','09:00~22:00','沖繩紅芋塔、雪鹽夾心餅乾, 石垣島辣油、金楚糕, ORION 啤酒、泡盛','冷藏伴手禮最後再買',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (445,'hotel',113,0,'サンエー 石川ショッピングセンター','超市','09:00~22:00','新鮮海鮮熟食, 沖繩縣產蔬果, 恩納限定甜點','Villa附近最大超市',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (446,'hotel',113,1,'ローソン 恩納村店','超商','24小時','熱食關東煮, Orion啤酒, 恩納村在地牛奶布丁','24小時營業臨時補貨方便',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (447,'hotel',113,2,'業務スーパー うるま石川店','超市','09:00~21:00','自炊食材（肉品、調味料）, 業務用大份量零食, 飲料汽水','大份量食材適合自炊採買',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (448,'hotel',114,0,'FamilyMart 那覇壺川店','超商','24小時','沖繩限定飯糰, Orion啤酒, 早餐麵包零食','飯店旁步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (449,'hotel',114,1,'タウンプラザかねひで 壺川店','超市','09:00~23:00','沖繩縣產豬肉生鮮, 島豆腐, 沖繩泡盛','在地超市價格實惠',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (450,'hotel',114,2,'ドン・キホーテ 那覇国際通店','唐吉軻德','24小時','藥妝保養品, 日本限定零食, 雜貨生活用品','免稅藥妝一次買齊',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (451,'hotel',115,0,'イオン北谷店','超市','07:00~00:00','AEON自有品牌零食（90円均一）, 沖繩限定牛奶糖, 日本醬料/沙拉醬','早上7點就開門方便採買',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (452,'hotel',115,1,'FamilyMart 北谷美浜店','超商','24小時','沖繩限定飯糰, 早餐熱食, Orion啤酒','美國村旁24小時營業',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (453,'hotel',115,2,'MEGAドン・キホーテ 北谷店','唐吉軻德','24小時','藥妝保養品, 零食伴手禮, 日本限定商品','MEGA版品項更齊全',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (454,'entry',734,0,'りうぼう FOOD MARKET（生鮮・熟食區）','超市','09:00~22:00','沖繩縣產水果（芒果/鳳梨）, 島豆腐、沖繩豆腐製品, 現烤麵包（marco polo）','生鮮熟食質好又便宜',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (455,'entry',734,1,'りうぼう 零食・伴手禮區','超市','09:00~22:00','紅芋系列零食餅乾, 沖繩黑糖棒, Orion啤酒6瓶裝','伴手禮比國際通便宜',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (456,'entry',734,2,'DAISO 天久店（同商場內）','超市','09:00~22:00','旅行收納用品, 零食小物分裝袋, 日本百元雜貨','全品項110日圓均一價',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (457,'entry',737,0,'graniph 沖縄 PARCO CITY店','購物中心','10:00~21:00','日本設計師聯名T恤, 繩限定圖案服飾, 帆布手提袋','沖繩限定圖案值得收藏',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (458,'entry',737,1,'松本清 PARCO CITY店','藥妝','10:00~21:00','合力他命C發泡錠, 防曬乳SPF50（沖繩夏天必備）, LuLuLun沖繩限定面膜','防曬品項齊全可免稅',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (459,'entry',737,2,'無印良品 PARCO CITY店','購物中心','10:00~21:00','旅行用分裝瓶組, 香薰精油系列, 輕薄涼感寢具','日本售價比台灣便宜',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (460,'entry',739,0,'MEGAドン・キホーテ 北谷店','唐吉軻德','24小時','藥妝保養品免稅採購, 日本限定零食糖果, 美國村周邊雜貨','24小時營業隨時可逛。必買伴手禮：③沖繩黑糖夏威夷豆巧克力⭐5、⑥Royce鹽巧克力洋芋片⭐5、⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (461,'entry',739,1,'Carnival Park Mihama（摩天輪商場）','購物中心','10:00~22:00','沖繩雜貨伴手禮, 特色美式服飾, 沖繩限定周邊商品','摩天輪旁拍照打卡熱點',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (462,'entry',739,2,'イオン北谷店（美國村旁）','超市','07:00~00:00','AEON自有品牌零食（90円均一）, 日本醬料/燒肉醬, 沖繩縣産飲料','營業到午夜方便宵夜採買',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (463,'hotel',116,0,'サンエー 石川ショッピングセンター','超市','09:00~22:00','新鮮海鮮熟食, 沖繩縣產蔬果, 恩納限定甜點','Villa附近最大超市',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (464,'hotel',116,1,'ローソン 恩納村店','超商','24小時','熱食關東煮, Orion啤酒, 恩納村在地牛奶布丁','24小時營業臨時補貨方便',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (465,'hotel',116,2,'業務スーパー うるま石川店','超市','09:00~21:00','自炊食材（肉品、調味料）, 業務用大份量零食, 飲料汽水','大份量食材適合自炊採買',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (466,'entry',742,0,'名護鳳梨園 Gift Shop','伴手禮','09:00~18:00','鳳梨酒（パイン酒）, 鳳梨果凍/果醬禮盒, 鳳梨夾心餅乾','試吃區可免費品嘗再買',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (467,'hotel',117,0,'FamilyMart 那覇壺川店','超商','24小時','沖繩限定飯糰, Orion啤酒, 早餐麵包零食','飯店旁步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (468,'hotel',117,1,'タウンプラザかねひで 壺川店','超市','09:00~23:00','沖繩縣產豬肉生鮮, 島豆腐, 沖繩泡盛','在地超市價格實惠',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (469,'hotel',117,2,'ドン・キホーテ 那覇国際通店','唐吉軻德','24小時','藥妝保養品, 日本限定零食, 雜貨生活用品','免稅藥妝一次買齊',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (470,'entry',752,0,'ポケモンセンターオキナワ（寶可夢中心）','購物中心','10:00~21:00','沖繩限定皮卡丘公仔, 沖繩限定寶可夢文具, 寶可夢沖繩版T恤','沖繩限定商品很搶手',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (471,'entry',752,1,'イオンスタイル ライカム（1F超市）','超市','09:00~22:00','沖繩縣産フルーツ（芒果、鳳梨）, 阿古豬品牌肉品, 沖繩限定零食伴手禮','伴手禮種類多可一次買齊',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (472,'entry',752,2,'ウエルシア薬局 ライカム店','藥妝','10:00~21:00','日本藥妝採購（合力他命、眼藥水）, 防品SPF50+, 面膜、保養品','可免稅結帳品項齊全',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (473,'entry',755,0,'御菓子御殿 國際通松尾店','伴手禮','09:00~22:00','紅芋生塔（現烤）, 紅芋塔禮盒（10/16入）, 黑糖巧克力','現烤紅芋生塔只有現場有。必買：⑧砂糖樹夾心餅乾⭐4.5',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (474,'entry',755,1,'塩屋 國際通本店','伴手禮','10:00~22:00','雪鹽冰淇淋（現場限定）, 宮古島雪鹽棉花餅, 各式風味鹽禮盒','可免費試吃各種風味鹽。必買：①雪塩夾心餅乾(雪塩さんど)⭐4.5、②雪塩巧克力酥⭐4.5',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (475,'entry',755,2,'ドン・キホーテ 那覇国際通店','唐吉軻德','24小時','藥妝保養品免稅採購, 沖繩限定零食糖果, Orion啤酒禮盒裝','最後採購機會24小時營業。必買伴手禮：④石垣島辣油⭐5、⑨南風堂辣味蝦餅⭐5、⑩HORINISHI萬能調味粉⭐4.5',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (476,'entry',757,0,'マツモトキヨシ（松本清）那覇メインプレイス店','藥妝','10:00~21:00','合力他命C發泡錐, DHC護唇膏, LuLuLun沖繩限定面膜','可免稅結帳',3.9,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (477,'entry',757,1,'サンエー食品館（1F超市）','購物中心','09:00~22:00','沖繩縣産アグー豚熟食, 沖繩限定Calbee薯條, 島野菜、地元鮮魚','熟食區品質高適合外帶',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (478,'entry',757,2,'ユニクロ（UNIQLO）那覇メインプレイス店','購物中心','10:00~21:00','AIRism涼感衣物（沖繩夏天必備）, UV防曬涼感帽, 輕薄外套（室內冷氣強）','夏天必買涼感衣物',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (479,'hotel',118,0,'FamilyMart 那覇壺川店','超商','24小時','沖繩限定飯糰, Orion啤酒, 早餐麵包零食','飯店旁步行1分鐘',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (480,'hotel',118,1,'タウンプラザかねひで 壺川店','超市','09:00~23:00','沖繩縣產豬肉生鮮, 島豆腐, 沖繩泡盛','在地超市價格實惠',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (481,'hotel',118,2,'ドン・キホーテ 那覇国際通店','唐吉軻德','24小時','藥妝保養品, 日本限零食, 雜貨生活用品','免稅藥妝一次買齊',4,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (482,'entry',761,0,'市場本通り 沖繩特産品店','伴手禮','09:00~20:00（依店家）','沖繩海鹽伴手禮, 沖繩泡盛（迷你瓶）, 沖繩傳統工藝品','巷弄內比大街便宜可比價。必買：④石垣島辣油⭐5、⑦沖繩褐藻&苦瓜香鬆⭐4',4.2,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (483,'entry',761,1,'マキシ食料品店（牧志市場内）','超市','08:00~21:00','新鮮海鮮（代煮食材）, 沖繩縣産島野菜, 冷凍烤豬肉（ラフテー）','1F選海鮮2F代煮',3.8,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (484,'entry',761,2,'ローソン 牧志公設市場前店','超商','24小時','沖繩限定甜點, 飲料補給, 行動電源充電','逛市場前後補給飲料方便',3.5,NULL,NULL,'ai');
INSERT OR IGNORE INTO shopping (id,parent_type,parent_id,sort_order,name,category,hours,must_buy,description,rating,maps,mapcode,source) VALUES (485,'entry',764,0,'おきなわワールド 伴手禮館','伴手禮','09:00~18:00','琉球玻璃製品（手工）, 泡盛試飲&購買, 沖繩傳統織品（紅型布）','手工琉球玻璃可現場挑選',4.2,NULL,NULL,'ai');

-- trip_docs
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (12,'banqiao-trip-2026-Onion','checklist','{"title":"出發前確認清單","content":{"cards":[{"color":"var(--blue-light)","title":"板橋景點預約","items":["林本源園邸（Day 1）：需提前上網購票，旺季週末常售罄，建議至少提前一週預約","確認林本源園邸當日導覽時段與費用（全票100元）","板橋435藝文特區（Day 1）：免費入園，確認特展是否需另購票"]},{"color":"var(--sand-light)","title":"花季景點確認","items":["土城桐花公園（Day 10）：油桐花通常四月上中旬盛開，出發前查詢當年花況","幸福水漾公園（Day 6）：花海季節約二至四月，提前確認四月初花況","建議下載新北市政府 APP 或查詢新北旅遊官網掌握花況即時資訊"]},{"color":"var(--blue-light)","title":"夜市與市場開放日","items":["湳雅觀光夜市（Day 3）：每週四、六、日有較多攤販，建議確認當日營業情況","樂華夜市（Day 9）：每天開放，但週末攤販最齊全","樹林興仁花園夜市（Day 11）：週三、五、六、日營業，4/11（六）正常開放","新莊廟街（Day 5）：確認廟宇參觀開放時間，部分廟宇早晚不定時關閉"]},{"color":"var(--sand-light)","title":"隨身備品","items":["悠遊卡或電子票證（部分停車場可用）","防曬乳SPF50+、帽子、太陽眼鏡（四月新北日照強）","輕便雨傘或雨衣（四月梅雨季前期，午後雷陣雨常見）","行動電源＋充電線","運動鞋（烘爐地、桐花公園、大安圳步道等需健走）"]},{"color":"var(--blue-light)","title":"博物館與古蹟確認","items":["山佳車站（Day 12）：市定古蹟，確認鐵道文化園區開放時間","空軍三重一村（Day 6）：確認開放時段，部分日期可能有特展導覽","十三行博物館（Day 15）：全票80元，每月第一個週日博物館日免費入場","紅毛城（Day 13）：國定古蹟，確認開放時間與票價"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (13,'banqiao-trip-2026-Onion','backup','{"title":"雨天／備案計劃","content":{"cards":[{"color":"var(--blue-light)","title":"Day 1-3 板橋雨天備案","weatherItems":["林本源園邸（Day 1）：部分庭園有亭台可遮雨，輕雨仍可參觀","板橋435藝文特區（Day 1）：展覽館為室內空間，不受天候影響","板橋車站商圈（Day 2）：環球購物中心全室內，雨天首選","板橋慈惠宮（Day 3）：廟宇有屋簷遮蔽，輕雨可參觀","湳雅觀光夜市（Day 3）雨天備案：改往板橋車站美食街或環球B2餐廳"]},{"color":"var(--blue-light)","title":"Day 4-6 新莊・三重雨天備案","weatherItems":["新月橋（Day 4）：橋面為戶外空間，大雨建議改天，改往新莊圖書館或廟街室內逛街","大都會公園（Day 4）：露天公園，雨天改往三重環球購物中心","幸福水漾公園（Day 6）：大雨備案改往三重戲院或附近購物中心","空軍三重一村（Day 6）：部分展區為室內，輕雨仍可參觀"]},{"color":"var(--sand-light)","title":"Day 7-9 中和・永和雨天備案","weatherItems":["四號公園（Day 7）：戶外公園，雨天改往永和國立台灣圖書館（免費、設備完善）","烘爐地（Day 8）：山路雨天濕滑，雨天建議改期，改往中和環球購物中心","仁愛公園（Day 9）：輕雨可帶傘參觀，大雨備案改往附近咖啡廳或購物商場","樂華夜市（Day 9）：有部分有頂棚攤位，輕雨仍可逛，大雨改往室內餐廳"]},{"color":"var(--blue-light)","title":"Day 10-12 土城・樹林雨天備案","weatherItems":["桐花公園（Day 10）：登山步道雨天濕滑，大雨建議改期或改往土城承天禪寺廊道參觀","大安圳步道（Day 11）：輕雨可走，大雨備案改往樹林圖書館或購物商場","山佳車站（Day 12）：室外彩繪牆雨天仍可拍照，旁邊有室內鐵道展覽空間","鹿角溪濕地（Day 12）：大雨備案改往樹林市立圖書館或附近室內景點"]},{"color":"var(--sand-light)","title":"Day 13-15 淡水・八里雨天備案","weatherItems":["淡水老街（Day 13）：有騎樓遮蔽，輕雨仍適合逛街品嚐美食","紅毛城（Day 13）：部分建築為室內空間，輕雨可參觀","漁人碼頭（Day 14）：情人橋戶外空間，大雨備案改往淡水老街室內購物","淡水海關碼頭（Day 14）：有室內展覽廳，雨天仍可參觀","八里左岸（Day 15）：戶外空間，大雨備案改往十三行博物館（室內展覽）提前前往","十三行博物館（Day 15）：完全室內設施，雨天首選景點"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (14,'banqiao-trip-2026-Onion','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["土城桐花公園（Day 10）賞花時機需確認：油桐花通常於四月上中旬盛開，建議出發前查詢當年花況","淡水老街（Day 13）與漁人碼頭（Day 14）建議調換至週末，人潮較多但氣氛更佳","板橋林本源園邸（Day 1）需提前上網購票，旺季週末常售罄，建議至少提前一週預約","四月為梅雨季前期，建議每天出門前確認當日天氣，各景點備有雨天替代方案"]},{"title":"中優先","priority":"medium","items":["各日已新增午餐與晚餐推薦，部分餐廳需提前訂位（饗食天堂、藍乳酪、之間茶食器等）","三重幸福水漾公園（Day 6）花海季節約為二至四月，四月初可能花況漸退，建議提前確認","Day 12 山佳車站與鹿角溪濕地車程合計約40分鐘，建議先至山佳再沿省道往樹林方向移動","Day 8 烘爐地以夜景著名，若時間允許可改為傍晚上山，欣賞大台北盆地夜景","Day 2 板橋車站商圈、Day 5 新莊廟街、Day 8 中和環球、Day 13 淡水老街已新增購物推薦"]},{"title":"低優先","priority":"low","items":["Day 4 新月橋夜間有LED光雕秀，若時間允許可於傍晚回程時再繞行一次","Day 15 十三行博物館門票全票80元，博物館日（每月第一個週日）可免費入場","Day 5 新莊廟街保留完整清代廟宇建築群，建議預留45分鐘以上細細參觀","Day 11 樹林興仁花園夜市占地廣大，建議提前確認營業區域分布圖","Day 3 湳雅夜市、Day 9 樂華夜市、Day 11 興仁花園夜市為晚餐替代，可盡情嘗遍台灣小吃"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (15,'busan-trip-2026-CeliaDemyKathy','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程","route":"TPE → PUS","time":"真航空 LJ752｜02:40 出發 → 06:05 抵達（飛行約 2h25m）"},{"label":"回程","route":"PUS → TPE","time":"真航空 LJ751｜21:50 出發 → 23:40 抵達（飛行約 2h50m）"}],"airline":{"name":"真航空 Jin Air","note":"行李限額依訂票艙等確認"}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (16,'busan-trip-2026-CeliaDemyKathy','checklist','{"title":"出發前確認事項","content":{"cards":[{"color":"var(--blue-light)","title":"證件與簽證","items":["護照（效期需超過入境日 6 個月以上）","K-ETA 申請（韓國電子旅行許可，出發前 72 小時完成）","電子機票列印或截圖"]},{"color":"var(--blue-light)","title":"交通與通訊","items":["T-money 交通卡（機場購買或事先準備）","韓國上網 eSIM 或 WiFi 分享器","下載 Naver Map APP（韓國地圖首選）","下載 KakaoMap APP（備用導航）"]},{"color":"var(--blue-light)","title":"生活用品","items":["韓國轉接頭（Type C/F 圓腳兩孔）","行動電源","雨具（三月仍有機會下雨）","外套（三月釜山早晚溫差大，約 5~15°C）"]},{"color":"var(--blue-light)","title":"金錢","items":["韓幣兌換（台幣→韓幣，建議在台先換）","信用卡（韓國刷卡率高，Visa/Mastercard 為主）","跨國提款卡（備用）"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (17,'busan-trip-2026-CeliaDemyKathy','backup','{"title":"雨天備案","content":{"cards":[{"color":"var(--sand-light)","title":"室內景點","weatherItems":["新世界 Centum City 百貨（含 SPA LAND 汗蒸幕）","ARTE Museum 釜山（沉浸式數位藝術，室內展覽）","樂天百貨 西面店（購物＋美食街）","國際市場 室內商圈（傳統市場有遮棚）"]},{"color":"var(--sand-light)","title":"購物與美食","weatherItems":["南浦洞地下街（室內購物街）","西面地下街（大型地下商圈）","光復路購物街（部分有遮棚）","田浦咖啡街（咖啡廳巡禮）"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (18,'busan-trip-2026-CeliaDemyKathy','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["出發前申請 K-ETA（韓國電子旅行許可），避免現場卡關","T-money 交通卡提前準備或機場購買，搭地鐵公車必備","ARTE Museum 及 Skyline Luge 建議線上預約門票，避開排隊","下載 Naver Map 韓國導航最準確，Google Maps 在韓國不夠精確"]},{"title":"中優先","priority":"medium","items":["三月釜山櫻花季約 3/25 起，溫泉川有機會看到早開櫻花","韓幣建議在台灣先換部分，剩餘到釜山 ATM 提領匯率更好","老宅邸燒肉等熱門餐廳建議提前訂位，週末人潮多","松島纜車建議搭透明車廂，體驗更刺激"]},{"title":"低優先","priority":"low","items":["廣安里夜景建議晚間 7 點後前往，大橋燈光秀最美","Blue Line Park 膠囊列車假日人多，建議平日搭乘","超市採購建議最後一天集中購買，避免提著重物跑行程","韓國退稅門檻 ₩30,000 起，購物時記得索取退稅單"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (19,'busan-trip-2026-CeliaDemyKathy','emergency','{"title":"緊急聯絡資訊","content":{"cards":[{"color":"var(--blue-light)","title":"緊急電話","contacts":[{"label":"韓國報警","phone":"112","url":"tel:112"},{"label":"韓國急救","phone":"119","url":"tel:119"},{"label":"韓國觀光諮詢","phone":"1330","url":"tel:1330"}]},{"color":"var(--blue-light)","title":"駐外單位","contacts":[{"label":"駐韓國台北代表部","phone":"+82-2-6329-6000","url":"tel:+82263296000"},{"label":"駐釜山辦事處","phone":"+82-51-463-7965","url":"tel:+82514637965"},{"label":"外交部旅外國人急難救助全球免付費專線","phone":"001-800-0885-0885","url":"tel:00180008850885"}]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (20,'kyoto-trip-2026-MimiChu','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程","route":"TPE(T2) → KIX(T1)","time":"CI156｜3/6（五）08:05→11:35"},{"label":"回程","route":"KIX(T1) → TPE(T2)","time":"CI153｜3/11（三）14:30→16:45"}],"airline":{"name":"中華航空","note":"機場接送已預約：去程 D3718929 / 回程 D3719086"}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (21,'kyoto-trip-2026-MimiChu','checklist','{"title":"出發前確認事項","content":{"cards":[{"color":"var(--blue-light)","title":"證件與入境","items":["護照效期確認（6個月以上）","Visit Japan Web 填寫：https://www.vjw.digital.go.jp/","eSIM 購買（Klook）：https://s.klook.com/c/Nw65v2RVyq"]},{"color":"var(--blue-light)","title":"交通","items":["WEST QR 註冊：https://guest-ui.west-qr.com/","Haruka 來回車票（WEST QR 購買）","機場接送 去程 D3718929","機場接送 回程 D3719086"]},{"color":"var(--blue-light)","title":"餐廳預約確認","items":["3/6 20:00 柚子元","3/7 20:00 燒肉甲","3/9 12:30 炭燒鰻","3/9 晚餐 Sukiyaki Niku no Hiroshige","3/10 12:30 宮川豚衛門"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (22,'kyoto-trip-2026-MimiChu','backup','{"title":"雨天備案","content":{"cards":[{"color":"var(--sand-light)","title":"室內替代方案","weatherItems":["京都國際漫畫博物館（烏丸御池步行5分鐘）","錦市場逛街吃小吃","京都車站 Porta 地下街購物","河原町百貨公司：高島屋、大丸、藤井大丸","追加咖啡巡禮：% Arabica、Walden Woods 等"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (23,'kyoto-trip-2026-MimiChu','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["金閣寺建議 10:00 前到避開人潮","伏見稻荷建議 9:00 開始爬，千本鳥居拍照人少","錦市場週三部分店家公休，請留意"]},{"title":"中優先","priority":"medium","items":["3月京都氣溫約 5-15°C，早晚溫差大，建議洋蔥式穿搭","宇治半日遊可搭配抹茶體驗（中村藤吉需排隊 30-60 分鐘）","ICOCA 卡建議購入，搭地下鐵巴士方便"]},{"title":"低優先","priority":"low","items":["京都地下鐵一日券 ¥800（烏丸線+東西線無限搭）","清水寺夜間特別拝観（3月中旬可能開放，可查官網）","嵐山竹林若有空可追加，JR 嵯峨野線約 15 分鐘"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (24,'kyoto-trip-2026-MimiChu','emergency','{"title":"緊急聯絡資訊","content":{"cards":[{"color":"var(--blue-light)","title":"緊急聯絡","contacts":[{"label":"日本緊急電話","phone":"110","url":"tel:110"},{"label":"台北駐大阪經濟文化辦事處","phone":"06-6443-8481","url":"tel:0664438481"},{"label":"中華航空客服","phone":"+81-6-6264-0202","url":"tel:+81662640202"},{"label":"Hotel Resol Trinity Kyoto","phone":"075-211-9269","url":"tel:0752119269"}]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (25,'okinawa-trip-2026-AeronAn','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程","route":"台北桃園 TPE → 那霸 OKA","time":"MM922（樂桃航空）｜4/24（五） 09:35 出發 → 12:20 抵達"},{"label":"回程","route":"那霸 OKA → 台北桃園 TPE","time":"MM929（樂桃航空）｜4/28（二） 16:45 出發 → 17:20 抵達"}],"airline":{"name":"樂桃航空 Peach Aviation","note":""}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (26,'okinawa-trip-2026-AeronAn','checklist','{"title":"出發前確認事項","content":{"cards":[{"color":"var(--blue-light)","title":"證件與通訊","items":["護照效期確認（6個月以上）","樂桃航空行李重量確認（7kg 手提限制）","日本 eSIM 或 WiFi 分享器","飯店訂房確認信列印"]},{"color":"var(--sand-light)","title":"金錢與行李","items":["日幣現金（建議 ¥50,000 以上，含餐費・交通・購物）","防曬乳 SPF50+、墨鏡、帽子","舒適步行鞋（每天走路多）","行動電源＋充電線","摺疊雨傘（四月偶有陣雨）"]},{"color":"var(--blue-light)","title":"交通與預約","items":["Yui Rail 單軌電車一日券 ¥800（Day 1 可用）","117 番高速巴士時刻表確認（Day 3 北部）","琉球の牛 TableCheck 線上訂位（Day 1 晚餐）","みやちく 電話或線上預約（Day 2 晚餐）"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (27,'okinawa-trip-2026-AeronAn','backup','{"title":"雨天備案","content":{"cards":[{"color":"var(--blue-light)","title":"Day 1 那霸市區雨天","weatherItems":["國際通有騎樓商店街，小雨仍可逛街用餐","首里城展覽室為室內設施，雨天可參觀","牧志公設市場為室內市場，完全不受影響"]},{"color":"var(--blue-light)","title":"Day 2 南部雨天","weatherItems":["玉泉洞為全室內鐘乳石洞，雨天完全不受影響","齋場御嶽為戶外，大雨時路面濕滑注意安全","備案：改為那霸市區購物或 DFS T ギャラリア"]},{"color":"var(--blue-light)","title":"Day 3 北部雨天","weatherItems":["美麗海水族館為全室內設施，雨天完全不受影響","備瀨福木林道為戶外，大雨時改在水族館園區內多逛","海洋博公園內有多間室內餐廳可避雨用餐"]},{"color":"var(--blue-light)","title":"Day 4 中部雨天","weatherItems":["美國村商場大多有屋頂，小雨可逛","殘波岬＆萬座毛為戶外景點，大雨時改往 AEON MALL 來客夢購物","御菓子御殿工廠見學為室內"]},{"color":"var(--blue-light)","title":"Day 5 回程雨天","weatherItems":["波上宮參拜約30分鐘，小雨可撐傘前往","瀨長島露台為戶外，大雨時改至那霸機場免稅店提早購物","機場內有 Blue Seal 和伴手禮店可消磨時間"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (28,'okinawa-trip-2026-AeronAn','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["Day 3 高速巴士建議搭 07:30~08:00 班次，水族館人潮較少可慢慢逛","Day 4 中部巴士班次較少，建議事先查好 28 番和 120 番時刻表，殘波岬到萬座毛可考慮打計程車（約 ¥3,000）","琉球の牛建議提前一週 TableCheck 線上訂位，熱門時段常客滿"]},{"title":"中優先","priority":"medium","items":["Day 2 南部路線：齋場御嶽→知念岬步行約5分鐘，知念岬→玉泉洞需搭巴士約30分鐘，注意班次銜接","Day 3 水族館 16:00 後入場有折扣，但搭高速巴士回程需注意末班車時間","Day 3 晚餐後國際通周邊推薦散步路線與景點（飯後 20:00~ 可逛）：","Day 1 晚餐後國際通散步建議（飯後 19:30~ 可逛）：","Day 4 晚餐後國際通夜散步建議（飯後 19:30~ 可逛）：","Day 5 瀨長島有免費接駁巴士（赤嶺站發車），時刻表請事先確認"]},{"title":"低優先","priority":"low","items":["沖繩四月底氣溫約 22~26°C，偶有陣雨，建議攜帶薄外套和摺疊傘","Yui Rail 單軌電車一日券 ¥800，Day 1 和 Day 5 市區移動很實用","牧志公設市場 2F 代客料理加工費 ¥500/人，建議中午前去（較新鮮）"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (29,'okinawa-trip-2026-HuiYun','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程","route":"桃園 TPE → 那霸 OKA","time":"7/2（四）虎航 IT232 18:30 出發 → 20:50 抵達（日本時間）"},{"label":"回程","route":"那霸 OKA → 桃園 TPE","time":"7/8（三）樂桃 MM927 13:15 出發 → 13:50 抵達"}],"airline":{"name":"","note":"去程虎航 / 回程樂桃"}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (33,'okinawa-trip-2026-HuiYun','emergency','{"title":"緊急聯絡","content":{"cards":[{"color":"var(--blue-light)","title":"緊急電話","contacts":[{"label":"警察 110","phone":"110","url":"tel:110"},{"label":"消防・救護 119","phone":"119","url":"tel:119"},{"label":"駐日代表處（緊急）+81-3-3280-7917","phone":"+81332807917","url":"tel:+81332807917"}]},{"color":"var(--blue-light)","title":"旅遊保險","notes":["出發前請確認已投保海外旅遊險"]},{"color":"var(--blue-light)","title":"住宿聯絡","contacts":[{"label":"BUZZ RESORT","phone":"+81-98-982-5337","url":"tel:+81989825337"}],"notes":["沖繩那霸美居飯店 Mercure Okinawa Naha — 3-3-19 Tsubogawa","HOPE VILLA Onnason — 恩納村"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (34,'okinawa-trip-2026-Ray','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程 CI 120","route":"TPE → OKA","time":"7/29（三）08:40→10:45"},{"label":"回程 CI 121","route":"OKA → TPE","time":"8/2（日）20:55→21:30"}],"airline":{"name":"華航 China Airlines","note":"訂位代號：TNCFHM｜華航 China Airlines｜3 位旅客"}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (35,'okinawa-trip-2026-Ray','checklist','{"title":"出發前確認事項","content":{"cards":[{"color":"var(--blue-light)","title":"證件與通訊","items":["護照（有效期 6 個月以上）","台灣駕照正本＋日文譯本（監理所 NT$100）","信用卡（海外消費免手續費佳）","日本 eSIM 或 WiFi 分享器","飯店訂房確認信"]},{"color":"var(--sand-light)","title":"金錢與行李","items":["日幣現金（建議備 ¥30,000 以上）","防曬乳 SPF50+、墨鏡、帽子","泳衣、水母衣（7-8月水母季）","行動電源＋充電線"]},{"color":"var(--blue-light)","title":"浮潛＋租車預約","items":["青之洞窟浮潛：出發前 1-2 個月預約（Day 2 7/30 09:00）","推薦中文店家：青潛、Natural Blue、黑潮潛水","タイムズカー 美栄橋駅前店｜取車 7/29 12:10｜還車 8/1 18:00｜預約 202600477681","需備文件：台灣駕照＋日文譯本＋護照"]},{"color":"var(--sand-light)","title":"景點注意事項","items":["THE GARLIC SHRIMP：不固定休，建議出發前確認是否營業","瀨底海灘：7-8月有水母出沒，建議穿水母衣","道之驛許田（Day 3 08:10）：可購美麗海水族館折扣票，比正門口便宜","首里城（Day 5）：正殿重建中，出發前確認最新開放範圍"]},{"color":"var(--sand-light)","title":"餐廳預約確認","items":["Day 1 晚餐「焼肉きんぐ 北谷店」— 暑假超搶手，務必提前 EPARK 預約","Day 1 晚餐「サムズマウイ 北谷店」— 鐵板燒秀人氣高，建議提前電話預約","Day 3 午餐「焼肉もとぶ牧場 もとぶ店」— 建議 TableCheck 提前預約","Day 3 晚餐「焼肉五苑 名護店」— 建議官網提前預約","Day 3 晚餐備選「美ら花 別邸」— 週三公休，建議 HotPepper 預約","Day 4/5「燒肉琉球の牛 國際通店」— 僅 17:00 起營業，建議 TableCheck 預約"]},{"color":"var(--blue-light)","title":"飯店預約確認","items":["Vessel Hotel Campana 北谷（7/29 一晚）","Super Hotel 名護（7/30-31 二晚）— 免費停車＋早餐＋溫泉","東橫inn 那霸美榮橋站（8/1 一晚）"]},{"color":"var(--sand-light)","title":"颱風動態追蹤","items":["確認時間：出發前 3-5 天","7-8月為颱風季，需密切注意天氣預報","建議下載：Windy 或 tenki.jp APP"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (36,'okinawa-trip-2026-Ray','backup','{"title":"颱風/雨天備案","content":{"cards":[{"color":"var(--blue-light)","title":"Day 1 雨天備案（北谷）","weatherItems":["AEON Mall 北谷（購物＋美食街）","琉球村（室內體驗琉球文化）","體驗王國 むら咲むら（手作體驗）"]},{"color":"var(--blue-light)","title":"Day 2 雨天備案（恩納・瀨底）","weatherItems":["青之洞窟：海況不佳時店家會改室內體驗或退費","瀨底海灘改為：名護鳳梨園（室內遊園車）或 ORION 啤酒工廠見學（免費試飲）","ORION 啤酒工廠見學（免費試飲，名護市內備案）"]},{"color":"var(--blue-light)","title":"Day 3 雨天備案（水族館・古宇利）","weatherItems":["水族館不受天候影響，正常參觀","道之驛許田有屋頂＋室內用餐區","古宇利島改為：古宇利オーシャンタワー（室內展望）或延長水族館＋本部市區逛街"]},{"color":"var(--blue-light)","title":"Day 4 雨天備案（來客夢・那霸）","weatherItems":["伊芸SA：室內有食堂與商店，展望台有屋頂，小雨不影響","AEON Mall 來客夢為室內購物中心，不受影響","國際通逛街購物不受天候影響（騎樓＋室內商店）"]},{"color":"var(--blue-light)","title":"Day 5 雨天備案（那霸）","weatherItems":["首里城城牆＋守禮門仍可參觀（有屋頂區域）","國際通逛街購物不受天候影響（騎樓＋室內商店）","唐吉訶德、わしたショップ、御菓子御殿均為室內","機場出發前可在免稅店衝刺採購"]},{"color":"var(--sand-light)","title":"颱風來襲對策","weatherItems":["航班異動：確認航空公司官網","水上活動全面停止","改為室內行程：購物中心、水族館","緊急聯絡：租車公司、飯店"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (37,'okinawa-trip-2026-Ray','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["Day 2 青之洞窟浮潛：7-8月暑假旺季非常搶手，務必出發前 1-2 個月完成預約（青潛 / Natural Blue / 黑潮潛水）","Day 5 午餐「琉球の牛」營業時間 17:00 起，12:30 午餐時段未營業，建議選暖暮拉麵或花笠食堂","Day 1 晚餐「焼肉きんぐ 北谷店」暑假週末需提前 EPARK 預約，否則可能候位 1 小時以上","Day 3 午餐「焼肉もとぶ牧場 もとぶ店」水族館附近牧場直營，建議 TableCheck 提前預約"]},{"title":"中優先","priority":"medium","items":["Day 2 恩納午餐 THE GARLIC SHRIMP 不固定休，建議出發前一天確認是否營業","Day 2 瀨底海灘 7-8月有水母出沒，建議穿水母衣或選有防護網區域戲水","Day 2 瀨底海灘雨天可改為名護鳳梨園（室內遊園車）或 ORION 啤酒工廠見學","Day 3 古宇利島建議預留充足時間，心型岩＋海灘＋蝦蝦飯＋大橋拍照都很值得","Day 3 道之驛許田（08:10 停留）記得購買美麗海水族館折扣票，可省費用","Day 4 AEON Mall 來客夢退稅：單店消費 ¥5,000 以上可辦理免稅，記得帶護照"]},{"title":"低優先","priority":"low","items":["Day 5 首里城正殿重建中（預計 2026 完工），出發前確認最新開放範圍","Day 2-3 名護兩晚住同一家 Super Hotel，可將大行李留車上或房間，輕裝出遊","FunPASS 美麗海套票可涵蓋水族館，查看最新優惠組合","Day 1 北谷唐吉訶德 24H 免稅，抵達當天即可採購藥妝零食","Day 4/5 國際通購物多店退稅可合算（同一天），わしたショップ＋御菓子御殿＋唐吉訶德可統一辦理","Day 3 古宇利島日落時分大橋景色絕美，可安排傍晚最後再過橋拍照"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (38,'okinawa-trip-2026-Ray','emergency','{"title":"緊急聯絡資訊","content":{"cards":[{"color":"var(--blue-light)","title":"日本報警","contacts":[{"label":"警察 110","phone":"110","url":"tel:110"},{"label":"消防・救護 119","phone":"119","url":"tel:119"}]},{"color":"var(--blue-light)","title":"那霸市立病院","contacts":[{"label":"098-884-5111","phone":"098-884-5111","url":"tel:098-884-5111"}],"address":"那霸市古島 2-31-1"},{"color":"var(--blue-light)","title":"北部地區醫院（名護）","contacts":[{"label":"0980-52-2719","phone":"0980-52-2719","url":"tel:0980-52-2719"}],"address":"名護市大中 2-12-3"},{"color":"var(--blue-light)","title":"台北駐日經濟文化代表處","contacts":[{"label":"03-3280-7811","phone":"03-3280-7811","url":"tel:+81332807811"},{"label":"急難救助 080-6552-4764","phone":"080-6552-4764","url":"tel:+81806552-4764"}]},{"color":"var(--blue-light)","title":"沖繩觀光多語言客服","contacts":[{"label":"098-851-6464","phone":"098-851-6464","url":"tel:098-851-6464"}],"notes":["09:00~21:00（中文可通）","09:00~21:00（中文可通）"]},{"color":"var(--blue-light)","title":"租車公司緊急聯絡","contacts":[],"notes":["事故時先撥 110 報警，再聯絡租車公司"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (39,'okinawa-trip-2026-RayHus','flights','{"title":"航班資訊","content":{"segments":[{"label":"去程 MM926","route":"TPE → OKA","time":"3/6（五）15:20→17:50"},{"label":"回程 MM925","route":"OKA → TPE","time":"3/11（三）11:35→14:20"}],"airline":{"name":"樂桃航空 Peach Aviation","note":"樂桃航空 MM926/MM925"}}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (40,'okinawa-trip-2026-RayHus','checklist','{"title":"出發前確認事項","content":{"cards":[{"color":"var(--blue-light)","title":"證件與通訊","items":["護照（有效期6個月以上）","信用卡（海外消費免手續費佳）","日本 eSIM 或 WiFi 分享器","飯店訂房確認信（Living Inn + THE NEST NAHA）"]},{"color":"var(--sand-light)","title":"金錢與行李","items":["日幣現金（建議備 ¥30,000 以上，含購物、餐費、交通）","防曬乳 SPF50+、墨鏡、帽子","舒適步行鞋（一日遊走路多）","行動電源＋充電線","泳衣（THE NEST NAHA 14F 溫水游泳池）"]},{"color":"var(--blue-light)","title":"一日遊預約確認","items":["KKday 北部一日遊：集合 08:00 縣民廣場（Day 2 3/7）","Klook 西海岸一日遊：集合 12:30 Blue Seal Palette 久茂地店（Day 3 3/8）","確認集合地點與緊急聯絡方式","下載 KKday／Klook APP，備妥電子票券"]},{"color":"var(--sand-light)","title":"飯店預約確認","items":["Living Inn 旭橋駅前（3/6~3/9 三晚）","THE NEST NAHA（3/9~3/11 兩晚）","Day 4 換飯店：10點前退房 Living Inn，行李寄放至 THE NEST 再出發"]},{"color":"var(--blue-light)","title":"購物行程準備","items":["Day 4 AEON Mall 來客夢：備妥退稅所需護照正本","Day 5 iias 豐崎：查詢 98/55/56 號巴士時刻表再出發","準備大容量購物袋或折疊行李箱（應付購物戰利品）"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (41,'okinawa-trip-2026-RayHus','backup','{"title":"雨天備案","content":{"cards":[{"color":"var(--blue-light)","title":"Day 1 抵達那霸雨天","weatherItems":["國際通為有騎樓的商店街，小雨仍可逛街用餐","晚餐首選有店面的餐廳（琉球料理ぬちがふぅ 或 やっぱりステーキ），避免排隊淋雨","雨天建議搭單軌電車往返，勿步行過遠"]},{"color":"var(--blue-light)","title":"Day 2 KKday 北部一日遊雨天","weatherItems":["美麗海水族館為全室內設施，雨天完全不受影響","古宇利島為戶外景點，輕雨仍可前往心形岩（注意路面濕滑）","名護鳳梨公園遊園車為半室內設施，雨天仍正常運行","全程跟團，交通由 KKday 統一安排，無需擔心交通問題"]},{"color":"var(--blue-light)","title":"Day 3 Klook 西海岸一日遊雨天","weatherItems":["波上宮為戶外神社，輕雨仍可參拜（備傘）","殘波岬燈塔雨天請注意安全，強風大雨時可在車內觀景","美國村室內商店眾多，雨天購物逛街完全不受影響","東南植物樂園燈光秀雨天照常舉行，部分區域有遮雨設施"]},{"color":"var(--blue-light)","title":"Day 4/5 購物日雨天","weatherItems":["AEON Mall 來客夢為全室內購物中心，雨天完全不受影響","iias 豐崎部分為戶外廣場，雨天可專注室內商店區域","THE NEST NAHA 14F 溫水游泳池（9:00~22:00）為絕佳室內雨天備案","雨天等巴士建議提早出發，那霸巴士總站有遮雨設施"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (42,'okinawa-trip-2026-RayHus','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["Day 3 上午空白（12:30 才集合）：建議安排第一牧志公設市場（9:00 開市）品嚐沖繩新鮮海產，或在國際通附近咖啡廳悠閒享用早午餐（注意：Klook 行程已包含波上宮，上午無需重複前往）","Day 4 退稅提醒：AEON Mall 來客夢為日本最大 AEON，各店消費滿 ¥5,000 可辦退稅，記得攜帶護照正本辦理","Day 6 返程前空白（退房 09:00，飛機 11:35）：那霸機場免稅店開放至登機前，可購買泡盛、紅芋塔、海鹽零食等伴手禮；建議 09:30 前抵達機場辦理報到"]},{"title":"中優先","priority":"medium","items":["Day 1 晚餐計畫：抵達約18:30後，推薦暖暮拉麵（不需預約，快速解決）或ぬちがふぅ（沖繩傳統料理體驗）；やっぱりステーキ 通常不需預約也是好選擇","Day 2 晚餐預約：焼肉きんぐ おもろまち店人氣高，建議透過 EPARK 提前預約；うりずん（安里站）為歷史名店也值得一試","Day 3 晚餐（Klook 21:30 回到那霸）：ちぬまん 有島唄表演（24:00前）、暖暮拉麵（翌2:00前）、すばやー 深夜沖縄麵（21:00起營業）皆為深夜好選擇","Day 5 出發與回程時間確認：iias 豐崎巴士班次較少，建議出發前查詢 98/55/56 號實際時刻表；回程最晚建議 18:00 前搭車返回那霸"]},{"title":"低優先","priority":"low","items":["唐吉壺川店（那覇市壺川3丁目2番地1）：距離 THE NEST NAHA 步行約15分鐘，Day 4 或 Day 5 晚上可順路採買藥妝、零食與伴手禮","Day 5 晚餐推薦旭橋周邊：山将（創業37年老字號居酒屋，建議預約）、ひょうきん（鮮魚居酒屋）、葵屋（島唄現場演奏），都在旭橋站步行2分鐘內","THE NEST NAHA 溫水游泳池：14F 游泳池 9:00~22:00，Day 4 晚間 Check in 後或 Day 5 早晨均可使用，為此行難得的放鬆時光"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (43,'okinawa-trip-2026-RayHus','emergency','{"title":"緊急聯絡資訊","content":{"cards":[{"color":"var(--blue-light)","title":"急救與醫療","contacts":[{"label":"救護車/消防","phone":"119","url":"tel:119"},{"label":"那霸市立病院（24H急診）","phone":"098-884-5111","url":"tel:0988845111"}],"address":"那霸市古島2-31-1（單軌電車 市立病院前站直通）"},{"color":"var(--sand-light)","title":"駐日代表處","contacts":[{"label":"電話","phone":"098-862-7008","url":"tel:0988627008"},{"label":"24H 緊急聯絡","phone":"080-8056-0122","url":"tel:08080560122"}],"notes":["台北駐日經濟文化代表處那霸分處"],"address":"那霸市久茂地3-15-9 アルテビル那覇 6F"},{"color":"var(--blue-light)","title":"航空公司與報案","contacts":[{"label":"樂桃航空客服（台灣）","phone":"02-2656-3202","url":"tel:0226563202"},{"label":"樂桃航空客服（日本）","phone":"03-6731-9242","url":"tel:0367319242"},{"label":"警察報案","phone":"110","url":"tel:110"}],"notes":["信用卡掛失：請事先記錄各銀行海外掛失電話"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (44,'okinawa-trip-2026-HuiYun','checklist','{"title":"出發前確認清單","content":{"cards":[{"color":"var(--blue-light)","title":"證件與通訊","items":["護照（有效期 6 個月以上）","台灣駕照正本＋日文譯本（監理所 NT$100）","信用卡（海外消費免手續費佳）","日本 eSIM 或 WiFi 分享器","飯店訂房確認信（沖繩那霸美居飯店、BUZZ RESORT、HOPE VILLA）"]},{"color":"var(--blue-light)","title":"日本撥打電話（免漫遊 VoWiFi）","items":["情境：人在日本，沒開漫遊，手機插原本中華電信 SIM 卡","步驟 ①：開啟飛航模式","步驟 ②：開啟 Wi-Fi（連飯店、機場免費 Wi-Fi，或同伴分享熱點）","步驟 ③：確認手機顯示「VoWiFi」或「Wi-Fi Calling」或「中華電信 Wi-Fi」","步驟 ④：撥號 019 + 81 + 去掉開頭 0 的號碼（例：琉球の牛 098-965-2233 → 019 81 98 965 2233）","費率比較：中華漫遊 17 元/分鐘 vs 019 國際電話 8.6~9.6 元/分鐘","打回台灣門號：漫遊約 50 元/分鐘，VoWiFi 網內互打甚至免費"]},{"color":"var(--sand-light)","title":"金錢與行李","items":["日幣現金（建議備 ¥50,000 以上，含購物、餐飲、入場費）","防曬乳 SPF50+、墨鏡、帽子（7月沖繩紫外線強）","泳衣、浮潛裝備（Day 3 漁港體驗、Day 5 Ryukyu Beach Club）","行動電源＋充電線","輕薄外套（室內冷氣強）"]},{"color":"var(--blue-light)","title":"租車確認","items":["需備文件：台灣駕照＋日文譯本＋護照","確認取車地點：沖繩旅毛（Day 2 09:00）","確認還車地點：沖繩旅毛（Day 6 17:30），還車前先到附近人工加油站加滿油","加保免責補償險（CDW）建議","7座車 Toyota Alphard（4大3小共7人）"]},{"color":"var(--blue-light)","title":"住宿確認","items":["沖繩那霸美居飯店 Mercure（7/2、7/5、7/6 共三晚）","BUZZ RESORT Chatan（7/3 一晚，凌晨 01:04 入住）","HOPE VILLA Onnason（7/4–7/5 共二晚）"]},{"color":"var(--sand-light)","title":"行程預訂確認","items":["Day 2：PARCO CITY 浦添、浦添大公園（免費）","Day 3：青之洞浮潛體驗（需7天前預約，2人以上同行優惠 ¥7,900/人）","Day 4：沖繩美麗海水族館門票（建議線上預購）、名護鳳梨園","Day 5：永旺夢樂城沖繩來客夢、沖繩寶可夢中心","Day 6：第一牧志公設市場 2F 代煮服務（現場排號），瀨長島 ウミカジテラス"]},{"color":"var(--sand-light)","title":"颱風動態追蹤","items":["確認時間：出發前 3-5 天","7月為颱風季，需密切注意天氣預報","建議下載：Windy 或 tenki.jp APP"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (45,'okinawa-trip-2026-AeronAn','emergency','{"title":"����p����T","content":{"cards":[{"color":"var(--blue-light)","title":"�饻��ĵ","contacts":[{"label":"ĵ�� 110","phone":"110","url":"tel:110"},{"label":"����?���@ 119","phone":"119","url":"tel:119"}]},{"color":"var(--blue-light)","title":"���Q���߯f�|","contacts":[{"label":"098-884-5111","phone":"098-884-5111","url":"tel:098-884-5111"}],"address":"���Q���j�q 2-31-1"},{"color":"var(--blue-light)","title":"�_���a����|�]�W�@�^","contacts":[{"label":"0980-52-2719","phone":"0980-52-2719","url":"tel:0980-52-2719"}],"address":"�W�@���j�� 2-12-3"},{"color":"var(--blue-light)","title":"�x�_�n��g�٤�ƥN���B","contacts":[{"label":"03-3280-7811","phone":"03-3280-7811","url":"tel:+81332807811"},{"label":"�����ϧU 080-6552-4764","phone":"080-6552-4764","url":"tel:+818065524764"}]},{"color":"var(--blue-light)","title":"�R÷�[���h�y���ȪA","contacts":[{"label":"098-851-6464","phone":"098-851-6464","url":"tel:098-851-6464"}],"notes":["09:00~21:00�]����i�q�^"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (46,'banqiao-trip-2026-Onion','emergency','{"title":"����p����T","content":{"cards":[{"color":"var(--blue-light)","title":"�x�W��ĵ","contacts":[{"label":"ĵ�� 110","phone":"110","url":"tel:110"},{"label":"����?���@ 119","phone":"119","url":"tel:119"}]},{"color":"var(--blue-light)","title":"�ȪF������|","contacts":[{"label":"02-7728-2000","phone":"02-7728-2000","url":"tel:02-7728-2000"}],"address":"�s�_���O���ϫn���n���G�q 21 ��"},{"color":"var(--blue-light)","title":"�x�_�O����|","contacts":[{"label":"02-6628-9779","phone":"02-6628-9779","url":"tel:02-6628-9779"}],"address":"�s�_���s���ϫذ�� 289 ��"},{"color":"var(--blue-light)","title":"�s�_���ȹC�A�Ȥ���","contacts":[{"label":"02-2960-3456","phone":"02-2960-3456","url":"tel:02-2960-3456"}],"notes":["�O������ B1"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (51,'okinawa-trip-2026-HuiYun','backup','{"title":"颱風／雨天備案","content":{"cards":[{"color":"var(--blue-light)","title":"室內替代方案","weatherItems":["PARCO CITY 浦添 / 來客夢 AEON Mall — 大型室內購物中心","國際通商店街 — 有騎樓可遮雨，雨天照常逛","ASHIBINAA Outlet — 室內品牌購物","沖繩美麗海水族館 — 全室內，雨天最佳選擇（Day 4 本已排入）","玉泉洞 — 洞穴內不受天氣影響（Day 6 本已排入）","第一牧志公設市場 — 室內市場，雨天可延長停留時間"]},{"color":"var(--sand-light)","title":"Day 2 備案（浦添・美國村）","weatherItems":["浦添大公園溜滑梯若下雨 → 移至 PARCO CITY 美食街，或提早往美國村","美國村雨天仍可逛室內商店與餐廳，夜景受限但可接受"]},{"color":"var(--sand-light)","title":"Day 3 備案（殘波岬・萬座毛）","weatherItems":["青之洞浮潛體驗若因海況取消 → 業者全額退還按金，改安排 PARCO CITY 或美國村補逛","殘波岬、萬座毛為戶外景點，輕雨仍可參觀，強風颱風則跳過","翡翠海灘（備案）：海洋博公園內海灘，距恩納約 47 分鐘車程，若天氣好且時間充裕可於 check in 後前往（來回約 1.5 小時＋停留 30 分鐘）"]},{"color":"var(--sand-light)","title":"Day 4 備案（美麗海・古宇利）","weatherItems":["古宇利島環島與沙灘若下雨 → 縮短停留，改至室內咖啡廳或提早返回","名護鳳梨園室內展區不受天氣影響","美麗海水族館為全室內，惡劣天氣首選"]},{"color":"var(--sand-light)","title":"Day 5 備案（北谷・來客夢・國際通）","weatherItems":["Ryukyu Beach Club 若天候不佳 → 直接前往來客夢，可多留時間購物","國際通有騎樓，雨天可正常逛街"]},{"color":"var(--sand-light)","title":"Day 6 備案（牧志・瀨長島）","weatherItems":["瀨長島 ウミカジテラス 為半室外露台商場，小雨仍可，颱風則改 ASHIBINAA Outlet","ASHIBINAA Outlet 實際營業時間約至 20:00，建議 19:30 前到場；Can*Do、SPORTS DEPO 需提前確認營業時間","**世豐商店**（壺屋通り）— 台灣人老闆經營的伴手禮雜貨店，價格比免稅還便宜，室內不受天氣影響。鄰近國際通與壺屋燒物博物館，MAPCODE: 33 158 153*44。必買：石垣島辣油、雪鹽金楚糕（ちんすこう）、沖繩黑糖、昆布、干貝、沖繩限定泡麵、梅子、茶包。老闆是台灣人，中文溝通無障礙，店內不可拍照","**【備案購物行程】** 以下行程已從主線移出，時間充裕可安排：","**沖繩 ASHIBINAA Outlet**（約2小時）— 沖繩最大Outlet約100間品牌店。推薦購買：COACH Outlet あしびなー店：Coach手提包（約3折入手）, 皮革錢包/卡夾, Coach托特袋；ABC-Mart あしびなー店：Nike/Adidas限定款球鞋, New Balance日版限定, VANS帆布鞋；Le Creuset Outlet あしびなー：日本傳統花紋鑄鐵鍋, 琺瑯深鍋/炒鍋折扣款, 日本限定配色餐具","**Can*Do 百元商店**（約1小時）— 全品項110日圓均一價，適合買小禮物和旅行收納用品","**SPORTS DEPO 豐崎店**（約1小時）— 大型運動用品專賣店，日本限定Nike/Adidas運動鞋、戶外露營用品、高爾夫球具折扣區"]}]}}');
INSERT OR IGNORE INTO trip_docs (id,trip_id,doc_type,content) VALUES (56,'okinawa-trip-2026-HuiYun','suggestions','{"title":"AI 行程建議","content":{"cards":[{"title":"高優先","priority":"high","items":["**Day 6 全部 entries 缺少 location 地圖連結**：10 個景點的 location 均為 null，網頁上完全無法顯示導航按鈕。建議用改行程補上各景點地圖資訊（出發、牧志市場、沖繩媳婦、カフェくるくま、玉泉洞、波上宮、瀨長島、加油站、晚餐、還車）","**Day 6 沖繩媳婦→カフェくるくま 交通時間標記有誤**：travel_desc 寫「約10分鐘」，但沖繩媳婦位在那覇曙、カフェくるくま在南城山上，實際車程約25~30分鐘。時間軸間隔25分鐘是對的，僅描述文字需修正","**Day 3/4/5 多處 geocode_status 為 review**：座標尚未驗證精確性，可能導致導航偏移。建議逐一確認或重新 geocode"]},{"title":"中優先","priority":"medium","items":["**Day 5 行程偏滿近12小時**：09:00~20:50，帶三個小孩（14、15、10歲）夏天沖繩可能偏累，建議保留彈性刪減空間（如 Ryukyu Beach Club 或 San-A Main Place 可視體力跳過）","**Day 6 還車動線建議**：目前是 晚餐（壺川附近）→ 開車去新都心還車 → 搭電車回壺川。可考慮 先還車 → 在新都心/おもろまち附近吃晚餐 → 搭電車回壺川飯店，動線更順暢","**多個餐廳 category 標記有誤**：如 Day 3 ラーメン暖暮 標為「甜點」、Day 4 焼肉てるりん 標為「甜點」、Day 5 一蘭拉麵 標為「海鮮」、焼肉もとぶ牧場 標為「甜點」等，僅影響分類顯示不影響內容描述"]},{"title":"低優先","priority":"low","items":["Day 3 青之洞浮潛需提前7天網路預約（預約電話 098-965-2452）","Day 7 樂桃在LCC航廈，需從國內線航廈搭接駁巴士前往，建議額外預留20~30分鐘","伴手禮採買分散多處，建議集中1~2處主力採買（推薦 Day 5 來客夢AEON + Day 6 沖繩媳婦）","已修正：Day 5 天氣資料已設定、Day 3 午餐已有評分、Day 7 退房改計程車、Day 5 寶可夢中心改步行、Day 2 BUZZ RESORT 地區描述已更正"]}]}}');

-- trip_requests (was: requests)
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (1,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','以下是幾點行程建議供參考：

1. D2 青之洞窟浮潛：暑假旺季建議提前 1~2 個月預約，可選中文教練的店家
2. D3 水族館：在道之驛許田買折扣門票可省不少，建議 9:00 開園就進場避開人潮
3. 防曬準備：7 月底沖繩紫外線極強，海灘活動務必帶 SPF50+ 防水防曬、水母衣
4. 餐廳預約：D4 燒肉琉球の牛非常熱門，建議出發前就線上訂位
5. 最後一天：D5 行李可寄放飯店，輕裝逛首里城和國際通

如果有特定想調整的部分（例如換餐廳、加景點），歡迎用「修改行程」模式送出具體需求！','completed','2026-03-16 11:19:16');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (2,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','�o�h�ݰ_�ӬO���p�߭��ưe�X���A������D�w�b�U�@�h�^���o ??','completed','2026-03-16 15:40:00');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (3,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','排得進去！

Minamino Cafe（みなみのカフェ）在北谷美浜 レクー沖縄北谷スパ＆リゾート 1F，跟你們 Day 3（7/4）住的 BUZZ RESORT Chatan 在同一個美浜區域，距離很近。

Day 3 早上 08:00 出發去青之洞浮潛，行程備註也建議先吃輕食避免暈船，所以 07:00 左右去 Minamino Cafe 吃個早餐再出發剛剛好！

如果確定要加進行程，請用【修改行程】模式重新送出，我會幫你排進 Day 3 早上','completed','2026-03-16 15:40:34');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (4,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','✅ 已處理：已將「あぐーの隠れ家 富着店」新增至第五天晚餐建議中（阿古豬涮涮鍋，¥3,000~，17:00~22:30）。注意此店位於恩納村富著，離國際通約40分鐘車程。','completed','2026-03-17 02:41:50');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (5,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','✅ 已處理：已將 ミナミノカフェ（Minamino Cafe）加入第三天早餐推薦，位於北谷美浜 American Village，平日 07:00 開門，高級吐司早餐咖啡廳。','completed','2026-03-17 02:42:46');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (6,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','🛍️ 購物建議整理

你的行程已安排了很完整的購物時間，以下是重點提醒：

📍 Day 4 — AEON Mall 來客夢（10:15-15:00）
這是最主要的購物時段，建議優先攻略：
• 寶可夢中心：沖繩限定皮卡丘玩偶，開門就衝
• KOJIMA×BIC CAMERA：家電/美容電器，滿 ¥5,000 免稅（帶護照）
• AEON STYLE 3F：伴手禮種類最齊全，推薦沖繩黑糖夏威夷豆巧克力⭐5、Royce 鹽巧克力洋芋片⭐5

📍 Day 4 晚上 — 國際通（17:00-20:00）
• 御菓子御殿：紅芋塔（¥1,100/10入）沖繩 No.1 伴手禮
• 鹽屋：雪塩夾心餅乾⭐4.5、雪塩巧克力酥⭐4.5，可現場吃雪鹽冰淇淋
• 唐吉訶德：營業到凌晨 3 點，晚餐後人少好逛，滿 ¥5,500 免稅

📍 Day 5 — 最後衝刺採購（11:00-12:30）
• 週日 12:00 後國際通封街成步行者天國
• わしたショップ：沖繩物產公社直營，石垣島辣油⭐5 必買
• 泡盛專賣：可試飲，古酒送禮體面

📍 Day 5 — 那霸機場（17:15 後）
• 國內線 2F：Blue Seal 冰淇淋（紅芋口味）
• 最後補貨機會：Royce 鹽巧克力洋芋片、南風堂辣味蝦餅、砂糖樹夾心餅乾

💡 省錢秘訣
1. 免稅門檻：唐吉訶德 ¥5,500、BIC CAMERA ¥5,000，記得帶護照
2. 同款伴手禮 AEON 通常比國際通便宜，可先在來客夢比價
3. UNION 超市 24 小時營業，在地價格買水果零食最划算
4. 伴手禮 TOP 5 推薦：①雪塩夾心餅乾 ②雪塩巧克力酥 ③沖繩黑糖夏威夷豆巧克力 ④石垣島辣油 ⑤南風堂辣味蝦餅','completed','2026-03-17 03:52:03');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (7,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','## 沖繩五日自駕交通建議

### 租車
- **取車**：那霸機場 DFS 營業所（各大租車公司皆有），建議出發前在 Tabirai 或 OTS 官網預約
- **車型**：4 人以下推薦 Compact（如 Vitz / Fit），省油好停車；有大行李選 Wagon（如 Freed）
- **還車**：最後一天那霸市區還車或機場附近 DFS 歸還，預留 1 小時辦手續
- **導航**：車上 GPS 支援 **Mapcode** 輸入（行程中每個景點皆已附 Mapcode），設定語言為中文或英文

### 高速公路
- 沖繩自動車道（那霸 IC ↔ 許田 IC），全程約 57km
- 費用約 ¥1,100（普通車），走高速北上到名護省 30 分鐘
- **建議**：Day 1 機場→北谷走國道 58（約 40 分鐘，沿路風景好）；Day 2 北谷→恩納→瀨底→名護走混合路線；Day 3~4 長距離北部行程走高速

### 停車
- 飯店停車：Vessel Hotel ¥500/晚、Super Hotel 名護免費、Loisir Grand 那霸 ¥1,500/晚
- 景點停車：美麗海水族館免費、古宇利島免費、美國村周邊公營停車場 ¥100~300/次
- **注意**：國際通附近停車貴（¥300~500/小時），最後一天建議先還車再逛

### 加油
- 沖繩油價約 ¥165~175/L（Regular），5 天估計總油費 ¥3,000~4,000
- 還車前找「セルフ」加油站（自助式較便宜），DFS 附近加油站多

### 實用提醒
1. 沖繩靠**左行駛**（與台灣相反），右轉要特別注意對向來車
2. 速限一般道路 40~60 km/h、高速 80 km/h
3. 夏天（7-8月）下午常有陣雨，開車注意路面濕滑
4. 租車保險建議加 **NOC 免責補償**（Non-Operation Charge），約 ¥550/天
5. ETC 卡可向租車公司租借（¥330/次），走高速更方便','completed','2026-03-17 06:34:38');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (8,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','## 沖繩 7/29–8/2 天氣概況

你的行程落在沖繩盛夏，以下是歷史氣候統計：

### 氣溫
| | 高溫 | 低溫 |
|---|---|---|
| 7 月底 | 31–32°C | 27°C |
| 8 月初 | 31°C | 27°C |

整體高溫穩定在 **31–32°C**，夜間也有 **27°C**，體感會更熱（濕度接近 100%）。

### 降雨
- 7 月底：每天約 **29%** 機率下雨，多為午後短暫陣雨
- 8 月初：每天約 **37%** 機率下雨
- 通常是短暫大雨後快速放晴，不太影響行程

### 颱風風險
7 月底～8 月初是沖繩颱風季高峰，建議出發前一週關注日本氣象廳（JMA）颱風動態。若有颱風接近，青之洞窟浮潛和離島行程可能受影響。

### 實用建議
1. **防曬**：紫外線極強，SPF50+ 防水防曬必備，海灘活動穿水母衣
2. **補水**：隨身帶水，便利商店和自動販賣機很密集
3. **午後雷陣雨**：攜帶輕便雨具，室內備案可安排在下午（如 AEON Mall）
4. **穿著**：輕薄透氣為主，室內冷氣很強建議帶薄外套
5. **海水溫度**：約 29°C，非常適合浮潛和海灘活動','completed','2026-03-17 07:57:41');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (9,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','## 沖繩五日自駕預算預估（2人）

| 項目 | 預算（TWD） |
|------|------------|
| 機票 CI 121 來回 ×2 | 16,000~30,000 |
| 租車 5 天（タイムズカー） | 5,500~7,700 |
| 油資 ~300km | 440~660 |
| 住宿 4 晚（含早餐） | 9,700~13,240 |
| 餐費 5 天（午+晚） | 7,260~15,180 |
| 活動（浮潛+水族館+單軌） | 3,730~4,830 |
| 停車+雜費 | 550~700 |
| 伴手禮/購物 | 8,000~20,000 |

### 總計（2人，含機票）
- 精省版：**NT$51,000~70,000**
- 一般版：**NT$61,000~85,000**

> 匯率 ¥1 ≈ NT$0.22，出發前請確認最新匯率
> 唐吉軻德/藥妝滿 ¥5,000 可免稅，記得帶護照','completed','2026-03-17 08:14:04');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (10,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','## 台北→沖繩航空公司推薦

你的行程 CI 121 已訂華航，以下是所有直飛選項供參考：

| 航空公司 | 航線 | 特色 |
|---------|------|------|
| **華航 CI** | 桃園↔那霸 | 你目前的選擇，正規航空含托運行李 |
| 長榮 BR | 桃園↔那霸 | 服務品質佳，機上餐好吃 |
| 台灣虎航 IT | 桃園↔那霸 | 廉航最便宜，但行李另計 |
| 樂桃 MM | 桃園↔那霸 | 日系廉航，偶有特價 |
| 星宇 JX | 桃園↔那霸 | 新航空，座位舒適 |

### 建議
- 暑假旺季（7/29 出發）建議**提早 3~4 個月訂票**，越晚越貴
- 華航含 23kg 托運行李，適合帶伴手禮回程
- 如果預算有限，虎航 + 加購行李通常最便宜
- 回程 20:55 起飛，下午在機場有充裕免稅店購物時間','completed','2026-03-17 08:18:24');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (11,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','Okinawa 5-day self-drive budget estimate (2 pax, rate JPY 1 = TWD 0.22)

[Fixed Costs - 2 pax total]
Flights CI 121 TPE-OKA r/t: TWD 8,000~15,000/pax x2 = TWD 16,000~30,000
Car rental Times Car 5 days: JPY 25,000~35,000 = TWD 5,500~7,700
Gas ~300km driving: JPY 2,000~3,000 = TWD 440~660
Hotels 4 nights:
  Vessel Hotel Chatan D1 (incl breakfast): JPY 15,000~20,000/2pax = TWD 3,300~4,400
  Super Hotel Nago D2&D3 (incl breakfast): JPY 10,000~14,000/night x2 = TWD 4,400~6,200
  Toyoko Inn Naha D4 (incl breakfast): JPY 9,000~12,000/2pax = TWD 2,000~2,640
  Hotel subtotal: TWD 9,700~13,240

[Meals - 2 pax, 5 days]
Breakfast: hotel included D1~D4, D5 outside JPY 1,000 = TWD 220
Lunch: JPY 1,200~2,800/pax x2 x5 = TWD 2,640~6,160
Dinner: JPY 2,000~4,000/pax x2 x5 = TWD 4,400~8,800
Meals subtotal: TWD 7,260~15,180

[Activities - 2 pax]
Blue Cave snorkeling: JPY 5,500~8,000/pax x2 = TWD 2,420~3,520
Churaumi Aquarium tickets (buy at Michi-no-Eki Kyoda for discount): JPY 2,180/pax x2 = TWD 960
Kouri Island: free
Naha monorail 1-day pass x2: JPY 800 x2 = TWD 352
Activities subtotal: TWD 3,730~4,830

[Souvenirs/Shopping]
Cosmetics, snacks, gifts (tax-free refund 8% over JPY 5,000): TWD 8,000~20,000

[Miscellaneous]
Parking 4 nights: JPY 500~550/night x4 = TWD 440~484
Beach locker/shower: JPY 500~1,000 = TWD 110~220

=== GRAND TOTAL (2 pax, excl flights) ===
  Budget: TWD 35,000~40,000
  Standard: TWD 45,000~55,000
  Incl shopping: TWD 60,000~80,000

Incl flights (2 pax):
  Budget: TWD 51,000~70,000
  Standard: TWD 61,000~85,000

Notes:
- Rate JPY 1 = TWD 0.22, check actual rate before departure
- Blue Cave snorkeling: book early online (popular in summer)
- Yakiniku King Chatan: must book via EPARK in summer
- Don Quijote/drugstore: tax-free over JPY 5,000~5,500, bring passport','completed','2026-03-17 08:25:33');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (12,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','✅ Webhook 測試確認：此請求已由排程 Agent 成功接收並處理。Webhook 機制運作正常。','completed','2026-03-17 08:28:16');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (13,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','? ���� debug ���սШD�]webhook env ���ա^�A�w�T�{����CWebhook ���ҥثe���A�Gfailed�A�i��ݭn�ˬd tunnel �s�u�� Agent Server �O�_���b�B��C','completed','2026-03-17 08:31:51');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (14,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','此為 webhook 測試請求，已確認收到。','completed','2026-03-17 08:37:26');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (15,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','此為 webhook 測試請求，已確認收到。','completed','2026-03-17 08:40:23');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (16,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','Webhook 部署測試確認收到，新部署運作正常，Agent 已成功接收並處理此請求。','completed','2026-03-17 08:42:45');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (17,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','? �w����z�����սШD�]final webhook test�^�C���� trip-plan �Ҧ����Ը����ШD�AWebhook + Agent �y�{�B�@���`�C�p�ݭק��{���e�A�Ч�� trip-edit �Ҧ��e�X�ШD�C','completed','2026-03-17 08:44:34');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (18,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','? �����t�δ��սШD�]async IIFE / waitUntil ���ա^�A�w�T�{����A�L�ݦ�{�ק�A�����ШD�C','completed','2026-03-17 08:47:24');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (19,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','? ������սШD�]post-deploy test after 4091183�^�CAgent �B�@���`�A���p�� webhook �B�z�y�{�T�{�L�~�C','completed','2026-03-17 08:48:22');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (20,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','�o�O�@�����սШD�]body: test promise style�^�A�L��ڦ�{�ק�ݨD�C�Y�ݭn�ȹC�ԸߩΦ�{�ק�A�Э��s�e�X����ݨD�C','completed','2026-03-17 08:51:11');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (21,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','? �w����z���߰ݡC���ШD�]title: result debug�Abody: check .first() result�^�P�_���t�ΰ������աA�D��{�ק�ݨD�C�Y�ݭק�R?��{�A�ХH trip-edit �Ҧ����s�e�X�ШD�A�ôy�z����ק鷺�e�C','completed','2026-03-17 08:54:00');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (22,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','webhook test received','completed','2026-03-17 08:57:13');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (23,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','嗨！你的「行程建議」請求已收到，但內容比較模糊，不確定想修改哪個部分。

以下是幾個可以考慮的方向：

1. **D2 浮潛**：暑假旺季建議提前 1~2 個月預約，可選有中文教練的店家
2. **D3 水族館**：在道之驛許田買折扣門票更划算，建議 9:00 開園就入場
3. **D4 燒肉琉球の牛**：非常熱門，建議出發前就線上訂位
4. **防曬準備**：7 月底紫外線極強，SPF50+ 防水防曬必備

如果想修改特定內容（例如換餐廳、加景點、調整時間），請用「改行程」模式送出具體描述，例如：
- 「D3 午餐換成きしもと食堂」
- 「D1 加一個 AEON 購物行程」','completed','2026-03-17 10:14:05');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (24,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','✅ 已處理：已將 ミナミノカフェ（Minamino Cafe）加入第三天早餐推薦，位於北谷美浜 American Village，平日 07:00 開門，高級吐司早餐咖啡廳。','completed','2026-03-18 09:37:17');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (25,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','✅ 已處理：已將 ミナミノカフェ（Minamino Cafe）加入第三天早餐推薦，位於北谷美浜 American Village，平日 07:00 開門，高級吐司早餐咖啡廳。','completed','2026-03-19 15:01:09');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (26,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','此請求內容不完整（未附具體案例），已由 #27 的完整 VoWiFi 電話撥打教學取代並處理完成。','completed','2026-03-20 14:27:53');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (27,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','✅ 已新增「日本撥打電話（免漫遊 VoWiFi）」卡片至出發前確認清單！

內容包含：
- 飛航模式 + Wi-Fi 連線步驟
- 撥號格式：019 + 81 + 去掉開頭 0 的號碼
- 費率比較（漫遊 vs 019 國際電話）
- 打回台灣門號的省錢方式','completed','2026-03-20 14:28:22');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (28,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','✅ 已將 Day 2 的 San-A Naha Main Place 移至 Day 5 晚餐後（19:11-20:11）。

**Day 2 調整**：移除 San-A 後，午餐提前至 11:48，後續行程順延調整。
**Day 5 調整**：晚餐（18:01-19:01）→ San-A（19:11-20:11）→ Check in（20:18）。

購物推薦（松本清、San-A 超市、UNIQLO）維持不變。','completed','2026-03-21 02:46:49');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (29,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','## 那霸美居 vs 那霸新都心飯店比較

以你們的行程來看，**推薦那霸美居飯店（メルキュール沖縄那覇）**，理由如下：

### 那霸美居（壺川）✅ 推薦
- **Day 1 深夜抵達**：壺川距那霸機場車程約 15 分鐘，深夜入住最方便
- **Day 7 回程**：退房後到機場很近，壺川駅搭單軌到機場只要 3 站約 10 分鐘
- **Day 6 還車後**：在新都心還完車，搭單軌從おもろまち駅→壺川駅只要 2 站約 5 分鐘，輕鬆回飯店
- **生活機能好**：步行 1 分鐘有 FamilyMart，附近有超市，離國際通也不遠
- **停車場**：飯店附設收費停車場，自駕方便

### 那霸新都心飯店
- **優點**：靠近 DFS 免稅店和 San-A Main Place 百貨，逛街方便；距還車點（沖繩旅毛新都心）步行可達
- **缺點**：距機場較遠（單軌約 20 分鐘），Day 1 深夜到和 Day 7 趕飛機都比較不方便

### 結論
你們 Day 1 深夜才到（23:09 check-in）、Day 7 要趕飛機，**離機場近是最大加分**。Day 6 還車雖然在新都心，但搭單軌回壺川只要 5 分鐘，完全不是問題。

👉 **建議選那霸美居，三晚（Day 1、Day 6、Day 7 前晚）同一間最省事！**

如果確定要改住宿，請用 **trip-edit** 模式送出修改請求。','completed','2026-03-21 02:48:57');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (30,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','## 結論：排除租車因素，仍然推薦那霸美居

既然租車業者會把車開到飯店、還車也到飯店收，那「距離租車店遠近」就不需要考慮了。但即使如此，**那霸美居（壺川）依然是最推薦的選擇**，原因如下：

### 排除租車後，剩下的關鍵考量

| 條件 | 那霸美居（壺川） | 那霸新都心 |
|------|:---:|:---:|
| Day 1 深夜抵達（23:09） | ⭐ 距機場近，計程車約15分鐘 | 距機場較遠，約25-30分鐘 |
| Day 7 趕飛機 | ⭐ 壺川駅→機場 3站約10分鐘 | おもろまち駅→機場 約20分鐘 |
| 單軌便利性 | ⭐ 壺川駅步行5分鐘 | おもろまち駅步行5分鐘 |
| 生活機能 | FamilyMart 1分鐘、超市步行3分鐘 | DFS、San-A百貨在旁 |

深夜到＋最後一天趕飛機，**離機場近是最大優勢**，這點不因租車而改變。

---

### 那霸美居附近可以逛的地方

**步行 5 分鐘內：**
- **FamilyMart 那覇壺川店** — 24小時，飯店旁1分鐘
- **タウンプラザかねひで 壺川店** — 在地超市，09:00~23:00，買沖繩生鮮和泡盛
- **壺川駅** — 單軌電車站，步行5分鐘

**步行 10~15 分鐘（或搭單軌 1~2 站）：**
- **波上宮** — 沖繩八社之首，崖上神社+波之上海灘，步行約12分鐘
- **波之上海灘** — 那霸市區唯一海灘，波上宮旁
- **國際通** — 那霸最熱鬧商店街，約1.2公里，步行15分鐘或搭單軌到牧志駅
- **ドン・キホーテ 國際通店** — 24小時免稅藥妝，在國際通上

**搭單軌 2~3 站：**
- **第一牧志公設市場** — 沖繩人的廚房，海鮮代煮
- **壺屋通** — 陶器街散步，世豊商店（台灣老闆伴手禮店）
- **新都心** — DFS免稅店、San-A Main Place百貨（おもろまち駅2站）

**計程車/開車 10~15 分鐘：**
- **瀨長島** — 白色露台商場看夕陽看飛機
- **沖繩 ASHIBINAA Outlet** — 約100間品牌店

---

### 總結

不管租車怎麼安排，你們 Day 1 半夜才到、Day 7 要趕飛機，**壺川的地理位置就是最省事的**。而且壺川本身生活機能好，要逛國際通、波上宮都很近，搭單軌去新都心也只要2站。

**建議維持那霸美居，三晚同一間最省事！**','completed','2026-03-21 03:01:14');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (31,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成 Day 2 + Day 5 調整：

1. **取車備註**：已在飯店出發項目中（沖繩旅毛會將車開到飯店交車）
2. **Plate Jam**：已加入 Day 2 晚餐備案餐廳
3. **PARCO CITY**：已排 3 小時（12:42-15:42）
4. **浦添大公園**：已在午餐前（10:22-11:22）
5. **タウンプラザかねひで 壺川店**：已加入 Day 5 San-A 後（20:15-20:45），回飯店前最後補貨站','completed','2026-03-21 03:22:47');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (32,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已將青之洞浮潛完整資訊加入 Day 3「前兼久漁港」的備忘錄，包含：

- 費用（¥8,500 / 同行優惠 ¥7,900）
- 活動時段與集合時間
- 費用包含項目
- 自備物品清單
- 注意事項（導航、暈船藥、天候取消政策）','completed','2026-03-21 03:35:54');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (33,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','Day 3 目前行程較滿（浮潛→殘波岬→午餐→萬座毛→業務超市→VILLA），加入 BIG 1 有兩個方案：

**方案 A：取代業務超市**
BIG 1 恩納村店（Mapcode 206 096 467）離 VILLA 更近，可取代業務超市宇流麻石川店，省下約 15 分鐘車程。品項也很齊全。

**方案 B：VILLA 入住後再去**
BIG 1 營業到 23:00，入住 VILLA 後傍晚再開車去（約 10 分鐘），可以悠閒採買不趕時間。

建議用「改行程」模式送出你想要的方案，例如：
- 「D3 用 BIG 1 取代業務超市」
- 「D3 VILLA 入住後加 BIG 1 採買」','completed','2026-03-21 03:38:06');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (34,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','以下是幾點行程建議供參考：

1. D2 青之洞窟浮潛：暑假旺季建議提前 1~2 個月預約，可選中文教練的店家
2. D3 水族館：在道之驛許田買折扣門票可省不少，建議 9:00 開園就進場避開人潮
3. 防曬準備：7 月底沖繩紫外線極強，海灘活動務必帶 SPF50+ 防水防曬、水母衣
4. 餐廳預約：D4 燒肉琉球の牛非常熱門，建議出發前就線上訂位
5. 最後一天：D5 行李可寄放飯店，輕裝逛首里城和國際通

如果有特定想調整的部分（例如換餐廳、加景點），歡迎用「修改行程」模式送出具體需求！','completed','2026-03-21 05:53:20');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (35,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','兩家都很推薦，各有強項，建議搭配買！

**業務超市（業務スーパー）— 食材首選**
- 冷凍肉片、冷凍蔬菜、調味料、醬料種類齊全，價格最便宜
- 大包裝零食餅乾很划算（如大袋仙貝、巧克力）
- 適合買「煮飯用的食材 + 大份量零食」
- 沖繩店舖：那霸新都心店、浦添店，你們自駕 Day1-2 順路很方便

**Big 1（ビッグワン）— 在地零食首選**
- 沖繩當地折扣超市，常有在地限定零食和沖繩特產
- 沖繩黑糖、紅芋塔、海鹽餅乾等在地點心選擇多
- 生鮮蔬果也不錯，適合買當天要煮的新鮮食材
- 價格也很實惠，比觀光區便宜很多

**建議買法**
1. **業務超市**買：冷凍肉、冷凍蔬菜、咖哩塊/醬料、大包裝零食
2. **Big 1**買：新鮮蔬果、沖繩在地零食點心、飲料
3. 如果只能去一家 → 業務超市（食材種類最齊全）

💡 Tip：兩家都可以刷信用卡，建議在 Day1 或 Day2 順路先補貨一次！','completed','2026-03-21 06:09:09');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (36,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成！D3 入住後新增「BIG1 採買」✅

修改內容：
- 新增 sort 7：16:30-17:15 BIG1 採買（ザ・ビッグ エクスプレス 石川店，AEON 系列折扣超市）
- VILLA 自由活動順延至 17:30（sort 8）
- 交通：VILLA → BIG1 車程約10分鐘 / BIG1 → VILLA 車程約15分鐘

tp-check: 🟢 12 🟡 0 🔴 0','completed','2026-03-21 07:01:59');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (37,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','已重新檢視全部 7 天行程，更新 AI 建議如下：

🔴 **高優先（4 項）**
- D5 缺 date/day_of_week/label
- D6 還車 sort 11 但時間 17:30 排在瀨長島 17:26 之後（時序錯亂）
- D6 Outlet 20:40 到但多數店 20:00 關、Can*Do/SPORTS DEPO 更晚
- D6 還車後 4 大 3 小交通方案未規劃

🟡 **中優先（6 項）**
- D3/D5 交通資訊大量缺失
- D4 VILLA→鳳梨園 travel 2 分鐘有誤（應~26 分）
- D6 世豊商店/玉泉洞→波上宮 travel 時間有誤
- D6 行程超載（09:00~00:51 超 15 小時）
- D3 day_of_week 空白

🟢 **低優先（6 項）**
- D2 BUZZ RESORT 描述修正、D6 午餐時間標題、D5 寶可夢中心時間、D3 浮潛預約、D7 LCC 航廈、伴手禮集中採買

完整建議已更新至行程頁面的「AI 建議」區塊。如需修正可用「改行程」模式送出請求。','completed','2026-03-21 15:59:27');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (38,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','**沖繩 7月底～8月初天氣概況**

🌡️ **氣溫**：28～33°C，體感溫度可達 36°C+（高濕度）

☀️ **天氣型態**：梅雨季約 6 月底結束，7 月底多為晴天或午後短暫雷陣雨，日照強烈

🌊 **海水溫度**：約 28～29°C，非常適合浮潛（青之洞窟）和海灘活動（瀨底海灘）

🌀 **颱風風險**：7～9 月為颱風季，建議出發前一週關注氣象預報。可下載「ウェザーニュース」APP 即時追蹤

☀️ **紫外線**：UV 指數 11+（極高），必備防曬乳 SPF50+、帽子、太陽眼鏡

🌅 **日出/日落**：約 05:55 / 19:15，傍晚適合安排海邊散步

💡 **穿搭建議**：輕薄透氣衣物、涼鞋、水母衣（浮潛防曬用）。室內冷氣強，建議帶薄外套

💧 **注意事項**：隨身攜帶水壺補水，車內備有冰涼飲料。自駕途中善用便利商店和道の駅補給','completed','2026-03-21 18:03:42');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (39,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','以下是兩間飯店的停車資訊比較：

## 沖繩那霸美居飯店（メルキュール沖縄那覇）
- **費用**：1 泊 ¥1,000（税込）
- **停車方式**：機械式立體停車場（升降機式），鑰匙交給櫃台
- **車輛限制**：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下 — **Alphard / Vellfire / RAV4 等大型車或高頂車無法停放**
- **預約**：不可預約，先到先停；滿車時需自行找附近收費停車場
- **24 小時進出**：是
- **附近替代**：旁邊有一般收費停車場可選用

## NAHA 新都心 HOTEL
- **費用**：1 泊 ¥1,100（税込）
- **停車方式**：飯店 1F 敷地內平面停車場，自行停好後到櫃台報停車位號碼
- **車輛限制**：普通車（含高頂車）皆可，共 10 台（含 1 台身障車位）
- **預約**：不可預約，先到先停；Check-in 時事前精算停車費
- **24 小時進出**：是

## 比較與建議
| 項目 | 那霸美居 | NAHA 新都心 |
|------|---------|------------|
| 費用 | ¥1,000/晚 | ¥1,100/晚 |
| 停車方式 | 機械式（升降機） | 平面自停 |
| 高頂車 | ❌ 不可 | ✅ 可以 |
| 車位數 | 較多 | 僅 10 台 |

**結論**：如果租的是一般轎車或小型車，兩間都 OK；如果租到 Alphard 等大型車，那霸美居的機械式停車場會放不進去，NAHA 新都心反而沒問題。建議取車時確認車型再決定。

如果想把這些停車資訊加進行程表，請用「改行程」模式重新送出，我會直接幫你更新飯店的停車欄位 🏨🅿️','completed','2026-03-22 00:59:19');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (40,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','收到！補交通移動資訊屬於行程修改，需要用「改行程」模式才能直接幫你寫入。

請到行程頁點「改行程」重新送出，內容可以寫：

> 請幫各天景點之間補上交通移動資訊（自駕車程預估時間）

這樣我就能直接幫每個景點之間加上開車時間與距離，完成後也會一併給你 AI 建議 🙌','completed','2026-03-22 01:00:59');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (41,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成！為 Day 3（殘波岬・萬座毛）、Day 5（來客夢・國際通）、Day 6（牧志・瀨長島）、Day 7（回程）補上交通移動資訊。

更新內容：
- 自駕路段標示為 car + 預估車程分鐘數
- 同商場/同商圈/同機場內移動標示為 walk
- Day 1、2、4 原本已有交通資訊，未變動

共更新 22 個景點的交通欄位。','completed','2026-03-22 01:17:43');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (42,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','確認過了，**Alphard 無法停美居飯店的停車場**（升降機式，車幅 ≤1.85m／車高 ≤2.0m，官網明確列出 Alphard 不可停放）。

備案已經有了：**タイムズ壺川スクエア**，就在飯店旁邊（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，RV／1BOX 車可停，Alphard 沒問題。

- 料金：60 分 200 円
- 24 時間最大：平日 1,000 円／假日 500 円
- 24 小時可入出庫

結論：不需要擔心，旁邊的タイムズ壺川スクエア就是現成的備案，價格也合理 👍','completed','2026-03-22 01:19:55');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (43,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已更新那霸美居飯店停車資訊（Day 1、Day 5、Day 6 共 3 筆）：

- 費用：1泊 ¥1,000（税込）
- 停車方式：機械式立體停車場（升降機式），鑰匙交給櫃台
- 車輛限制：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下（Alphard 等大型車無法停放）
- 預約：不可預約，先到先停
- 24小時進出：是
- 附近替代：タイムズ壺川スクエア（壺川 3-3），平面停車場，車高 2.1m，Alphard 可停，平日最大 1,000円／假日 500円','completed','2026-03-22 01:47:19');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (44,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','已更新 AI 行程建議！本次分析發現以下重點：

🔴 高優先（5 項）：
• Day 3/5/6/7 多個交通資訊出現亂碼
• Day 6 還車時序錯亂（17:30 還車排在 23:51 之後）
• Day 6 購物行程超過營業時間
• Day 6 還車後交通未規劃
• Day 5 label 仍為「Day 5」需改為描述性標籤

🟡 中優先（5 項）：
• Day 4/6 交通時間有誤
• Day 6 行程超載（09:00~00:51）
• Day 5 天氣資料未設定
• Day 3/5 缺少地圖連結

🟢 已修正：
• Day 3 星期已更正為「六」
• Day 5 日期/星期已填入

建議透過「改行程」模式送出修正請求來處理高優先項目。','completed','2026-03-22 01:48:37');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (45,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','那霸美居的停車資訊有補上囉！在 Day 1、Day 5、Day 6 的飯店卡片裡都有顯示。

重點整理：
- **費用**：1 泊 ¥1,000（税込）
- **車位**：機械式立體停車場，鑰匙交給櫃台，先到先停、不可預約
- **車輛限制**：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下（Alphard 等大型車無法停放）
- **替代方案**：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。60分 200 円，24 時間最大平日 1,000 円

如果在行程頁面上看不到，可以試試重新整理頁面（下拉更新），停車資訊會顯示在每天的飯店區塊裡。','completed','2026-03-22 02:05:41');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (46,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成修正：

1. **交通資訊亂碼修復** — Day 3（6筆）、Day 5（9筆）、Day 6（4筆）、Day 7（3筆），共 22 筆 entry 的 travel_desc 已從亂碼還原為正確中文（如「約15分鐘」「同商場」「同機場」等）。

2. **Day 5 標籤更新** — 已從「Day 5」改為「來客夢・國際通」。

所有修改已透過 API 寫入 D1 資料庫，刷新頁面即可看到更新。','completed','2026-03-22 02:07:15');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (47,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'lean.lean@gmail.com','測試成功！已收到你的請求。

如果你想修改行程內容，請用「改行程」模式送出具體的修改需求（例如：Day 2 下午換成另一個景點）。如果想問建議，用「問建議」模式即可。','completed','2026-03-22 07:58:02');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (48,'okinawa-trip-2026-Ray','trip-plan',NULL,NULL,'lean.lean@gmail.com','沖繩今日天氣（3/22）

氣溫約 17°C～22°C，有雲偶有短暫陣雨，體感舒適偏涼。三月沖繩正值春季，白天可穿薄長袖或短袖加薄外套。

不過你的行程是 7/29～8/2 夏季出發，屆時沖繩氣溫約 28°C～32°C，會是典型的炎熱海島天氣，記得做好防曬和補水準備！','completed','2026-03-22 08:14:40');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (49,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已更新！三天的那霸美居飯店（Day 1、Day 5、Day 6）現在都有完整停車資訊：

• 飯店停車場：1泊 ¥1,000（税込），機械式立體停車場，先到先停不可預約，車寬 185cm / 車高 200cm / 車長 500cm / 重量 2.3t 以下（Alphard 等大型車無法停放）
• 替代方案：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。60分 200円，24時間最大平日 1,000円

（Day 5 原本缺停車資訊，已補上）','completed','2026-03-22 11:00:30');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (50,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已重新計算所有行程時間，依「前一個行程結束 + 車程 = 下一個行程開始」原則重算：

**Day 1（那霸）**：未調整（航班固定時間）
**Day 2（浦添・美國村）**：未調整（時間已正確）
**Day 3（殘波岬・萬座毛）**：浮潛集合點改為 08:15（出發 08:00 + 車程 15 分），後續全部順延
**Day 4（美麗海・古宇利）**：修正水族館→Coffee 車程（34→10 分）、Coffee→海洋塔（10→25 分）、海洋塔→古宇利島（15→3 分），後半段順延約 10 分鐘
**Day 5（來客夢・國際通）**：未調整（時間已正確）
**Day 6（牧志・瀨長島）**：牧志市場提前至 09:07（原 10:21 有 81 分鐘空檔），午餐→瀨長島車程修正（6→15 分），全天提前約 1 小時
**Day 7（回程）**：機場活動提前至 10:15（退房 + 15 分車程）

⚠️ Day 6「沖繩旅毛 還車」目前排在時間軸最後（23:39），但租車公司通常 20:00 前需還車。建議將還車移到午餐後、瀨長島之前，以改行程方式重新送出調整。','completed','2026-03-22 11:06:24');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (51,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','那霸美居的停車資訊在 **Day 1（7/2）飯店卡片** 裡面喔！點開飯店名稱下方就能看到停車區塊。

幫你整理重點：

- **費用**：1泊 ¥1,000（税込）
- **類型**：機械式立體停車場（升降機式），鑰匙交給櫃台
- **車輛限制**：車寬 185cm、車高 200cm、車長 500cm、重量 2.3t 以下
- ⚠️ **Alphard / Vellfire 等大型車無法停放**
- 不可預約，先到先停；滿車時需自行找附近收費停車場
- **附近替代**：タイムズ壺川スクエア（壺川 3-3），平面停車場約 265 台，車高限制 2.1m，Alphard 可停。60分 200円，24h最大：平日 1,000円／假日 500円

因為我們租的是 Alphard，所以美居飯店的機械式停車場停不進去，要改停旁邊的タイムズ壺川スクエア喔！','completed','2026-03-22 11:14:17');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (52,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已幫你在 Day 2 美國村的晚餐新增 3 間推薦餐廳：

1. **タコライスcafé きじむなぁ 美浜店** ★4.0 — 沖繩塔可飯名店，起司蛋塔可飯為招牌，¥600~ 起，份量十足小孩也愛
2. **ステーキハウス88 北谷店** ★4.1 — 沖繩老字號牛排館，200g 嫩煎牛排搭鐵板蒜片，¥1,500~ 起，CP值高
3. **Transit Café** ★4.2 — 北谷海邊景觀餐廳，漢堡排＆海鮮義大利麵，¥1,000~ 起，日落時段海景超美

加上原本的迴轉壽司、浜屋沖繩麵、Blue Seal 冰淇淋，現在共有 6 間可以選擇囉！','completed','2026-03-22 13:32:06');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (53,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','這兩間都是台灣人開的沖繩伴手禮店，各有優勢，幫你整理比較：

## 世豐商店
- **位置**：壺屋通（國際通附近步行可達）
- **特色**：價格比市價便宜，大部分商品等於免稅價
- **品項**：辣油、餅乾、昆布、調味料、干貝、梅子、黑糖、巧克力等
- **優點**：價格最殺、離國際通近順路逛、老闆是台灣人溝通方便
- **缺點**：店面小（約8~10坪）、品項種類相對少

## 媳婦的店
- **位置**：離機場開車約10分鐘（不在國際通商圈）
- **特色**：客製禮包服務、中文帳單、可線上預訂熱門商品
- **品項**：花生豆腐、黑糖、香檸、雪鹽金楚糕、天使之羽、石垣島辣油、宮古牛洋芋片等
- **優點**：服務超貼心（會問你朋友喜好幫推薦）、還提供顧小孩/長輩服務讓你專心買、近機場適合最後一天補貨
- **缺點**：位置偏離觀光動線、需特地繞過去

## 建議
看你們行程，**兩間都排是最好的**：
- **世豐商店**排在逛國際通那天（Day 6），順路買
- **媳婦的店**排在最後一天還車前，離機場近適合最後補貨

如果只能選一間，帶三個小孩的話推薦**媳婦的店** — 她會幫忙顧小孩讓大人專心選購，這個服務太加分了！而且可以事先線上預訂怕被買走的人氣商品。

想要排進行程的話，請用**改行程**重新送出，告訴我要排在哪一天喔！','completed','2026-03-22 13:34:35');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (54,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','幫你分析 Day 6 把世豊商店換成沖繩媳婦的調整建議：

## 沖繩媳婦 基本資訊
- **位置**：泊港漁市場內（泊いゆまち）
- **營業時間**：10:30～14:30（⚠️ 下午兩點半就關了）
- **特色**：台灣老闆娘中文溝通、價格比國際通便宜、可客製禮包、可線上預訂
- **必買**：花生豆腐、黑糖、香檸、雪鹽金楚糕、天使之羽、石垣島辣油、宮古牛洋芋片

## 建議調整

直接把世豊商店的時段（10:44-11:44）換成沖繩媳婦即可，其餘不動：

| 時間 | 行程 | 備註 |
|------|------|------|
| 09:00 | 美居飯店出發 | |
| 09:07-10:37 | 第一牧志公設市場 | 不變 |
| **10:50-11:50** | **沖繩媳婦（泊港漁市場）** | **牧志→泊港約10分鐘車程，10:30開門剛好銜接** |
| 12:25-13:25 | 玉泉洞 | 泊港→南城約35分鐘 |
| 14:00-15:00 | 波上宮 | 微調 |
| 15:10-16:10 | 午餐 | 微調 |
| 16:25-18:25 | 瀨長島 | 微調 |
| 18:30-19:30 | 晚餐 | 不變 |
| 19:40-21:20 | ASHIBINAA Outlet | 不變 |
| 21:21~ | Can*Do → SPORTS DEPO → 還車 | 不變 |

## 重點提醒
- 沖繩媳婦 **14:30 就打烊**，排在上午是最佳時段
- 泊港漁市場離牧志市場約 10 分鐘車程，比世豊商店稍遠一點但路線順暢
- 整天行程節奏不變，只有中間幾站微調 10~15 分鐘

如果確定要改，請用**改行程**重新送出，我會直接幫你更新！','completed','2026-03-22 22:48:01');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (55,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','今天是 2026/3/23，距離出發日（7/29）還有約 4 個月，還不在行程期間喔！

## 沖繩 7/29～8/2 歷史天氣參考

| 項目 | 數值 |
|------|------|
| 平均氣溫 | 28～32°C |
| 海水溫度 | 約 28°C |
| 降雨 | 午後短暫雷陣雨為主，通常 30 分鐘內結束 |
| 日照 | 日出約 06:00、日落約 19:20 |
| 紫外線 | 極強（SPF50+ 必備） |
| 颱風 | 7～8 月為颱風季，出發前一週留意氣象 |

## 建議
- 行程中每天的天氣預報會在**出發前一週**自動更新到行程表
- 目前先做好防曬和雨具準備即可

有其他問題歡迎用**問建議**繼續問 😊','completed','2026-03-23 01:21:03');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (56,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','今天是 2026/3/23，距離出發日（7/29）還有約 4 個月，還不在行程期間喔！

## 沖繩 7/29～8/2 歷史天氣參考

| 項目 | 數值 |
|------|------|
| 平均氣溫 | 28～32°C |
| 海水溫度 | 約 28°C |
| 降雨 | 午後短暫雷陣雨為主，通常 30 分鐘內結束 |
| 日照 | 日出約 06:00、日落約 19:20 |
| 紫外線 | 極強（SPF50+ 必備） |
| 颱風 | 7～8 月為颱風季，出發前一週留意氣象 |

## 建議
- 行程中每天的天氣預報會在**出發前一週**自動更新到行程表
- 目前先做好防曬和雨具準備即可

有其他問題歡迎用**問建議**繼續問 😊','completed','2026-03-23 01:33:08');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (57,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','今天是 2026/3/23，距離出發日（7/29）還有約 4 個月，還不在行程期間喔！

## 沖繩 7/29～8/2 歷史天氣參考

| 項目 | 數值 |
|------|------|
| 平均氣溫 | 28～32°C |
| 海水溫度 | 約 28°C |
| 降雨 | 午後短暫雷陣雨為主，通常 30 分鐘內結束 |
| 日照 | 日出約 06:00、日落約 19:20 |
| 紫外線 | 極強（SPF50+ 必備） |
| 颱風 | 7～8 月為颱風季，出發前一週留意氣象 |

## 建議
- 行程中每天的天氣預報會在**出發前一週**自動更新到行程表
- 目前先做好防曬和雨具準備即可

有其他問題歡迎用**問建議**繼續問 😊','completed','2026-03-23 09:16:25');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (58,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成修改！

## 變更內容（Day 6 · 7/7 二）

| 項目 | 原本 | 修改後 |
|------|------|--------|
| 景點 | 世豊商店 | **沖繩媳婦 okinawa shinboo** |
| 地點 | 壺屋通 | 那覇市曙 1-4-8 |
| 時間 | 10:44-11:44 | 10:47-11:47 |
| 評分 | 4.0 | 4.5 |

### 同天微調
- 從牧志市場到沖繩媳婦車程調整為 **10 分鐘**（原 7 分鐘）
- 後續行程（玉泉洞→波上宮→午餐→瀨長島→晚餐→Outlet→還車）全部 **+4 分鐘**
- 最後還車時間 23:43（原 23:39），影響極小

### 沖繩媳婦必買
花生豆腐⭐5、黑糖⭐4.5、石垣島辣油⭐5、宮古牛洋芋片⭐4.5

⏰ 營業時間 10:30~14:30，台灣媳婦中文服務零障礙！

tp-check: 🟢 48  🟡 0  🔴 0','completed','2026-03-23 12:04:08');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (59,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已查看行程，處理結果如下：

## 查詢結果

- **世豐商店**：未出現在目前行程中，無需替換
- **沖繩媳婦 okinawa shinboo**：已在 **Day 6（7/7 二）** 行程中，排在 10:47-11:47

沖繩媳婦已經在行程裡了！如果你想要微調 Day 6 的時間安排或替換其他景點，請用**改行程**再描述想調整的部分 😊','completed','2026-03-23 12:07:36');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (60,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','此為重複請求，已在另一筆請求（#61）中處理完成。','completed','2026-03-23 14:28:51');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (61,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已將**世豐商店**加入 Day 6（7/7 二）的備案區！

## 世豐商店

📍 壺屋通り，鄰近國際通與壺屋燒物博物館
MAPCODE: 33 158 153*44

### 必買商品

| 商品 | 推薦度 |
|------|--------|
| 石垣島辣油 | ⭐⭐⭐⭐⭐ |
| 雪鹽金楚糕（ちんすこう） | ⭐⭐⭐⭐⭐ |
| 沖繩黑糖 | ⭐⭐⭐⭐ |
| 昆布 | ⭐⭐⭐⭐ |
| 干貝 | ⭐⭐⭐⭐ |
| 沖繩限定泡麵 | ⭐⭐⭐⭐ |
| 梅子 | ⭐⭐⭐ |
| 茶包 | ⭐⭐⭐ |

### 特色

- 老闆是**台灣人**，中文溝通零障礙
- 價格比其他店的免稅價還便宜
- 店內**不可拍照**（怕被同業看到標價）
- 室內店面，雨天也能安心逛

備案裡可以看到完整資訊，如果當天有空檔或下雨想找地方逛，就去世豐商店掃貨吧！','completed','2026-03-23 14:29:51');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (62,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','今天是 2026/3/23，距離出發日（7/29）還有約 4 個月，還不在行程期間喔！

## 沖繩 7/29～8/2 歷史天氣參考

| 項目 | 數值 |
|------|------|
| 平均氣溫 | 28～32°C |
| 海水溫度 | 約 28°C |
| 降雨 | 午後短暫雷陣雨為主，通常 30 分鐘內結束 |
| 日照 | 日出約 06:00、日落約 19:20 |
| 紫外線 | 極強（SPF50+ 必備） |
| 颱風 | 7～8 月為颱風季，出發前一週留意氣象 |

## 建議
- 行程中每天的天氣預報會在**出發前一週**自動更新到行程表
- 目前先做好防曬和雨具準備即可

有其他問題歡迎用**問建議**繼續問 😊','completed','2026-03-23 22:57:00');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (63,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## ✅ 已完成：午餐移到波上宮之前

### 調整內容

午餐從波上宮**之後**移到**之前**，並更換為南城順路餐廳推薦：

| 時間 | 景點 | 說明 |
|------|------|------|
| 12:17-13:17 | 玉泉洞 | （不變） |
| **13:27-14:27** | **午餐** | ⬆ 移到這裡 |
| 14:57-15:57 | 波上宮 | ⬇ 順延 |
| 16:12-18:12 | 瀨長島 | 時間微調 |

### 午餐推薦（南城・玉泉洞順路）

| 餐廳 | 類型 | 價位 | 說明 |
|------|------|------|------|
| **カフェくるくま** | 南洋料理 | ¥1,200~ | 招牌泰式綠咖哩，太平洋海景露台 |
| 浜辺の茶屋 | 咖啡輕食 | ¥900~ | 海邊懸崖絕景茶屋，法式吐司 |
| 山の茶屋・楽水 | 沖繩料理 | ¥1,000~ | 島野菜定食，健康清爽 |

三間都在玉泉洞附近 10 分鐘車程內，吃完再開 30 分鐘到波上宮，完全順路 🚗','completed','2026-03-24 02:36:48');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (64,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成修改 ✅

第六天午餐已移至**玉泉洞前面**，新順序：

1. 沖繩媳婦 → **午餐（カフェくるくま 等海景餐廳）** → 玉泉洞

### 調整內容
- 午餐時間：12:12-13:12（原 13:27-14:27）
- 玉泉洞時間：13:22-14:22（原 12:17-13:17）
- 午餐餐廳維持原推薦（カフェくるくま、浜辺の茶屋、山の茶屋），三間都在前往玉泉洞的順路上
- 後續景點時間微調（提早約5分鐘）

先吃飽再逛玉泉洞，比較有體力走800m的鐘乳石洞穴 😊','completed','2026-03-24 02:38:45');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (65,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成推薦 ✅

已為以下日期新增出發前早餐推薦（各 3 間餐廳）：

### Day 2（那覇壺川）
1. **ポークたまごおにぎり本店** — 沖繩名物豬肉蛋飯糰，07:00 開門
2. **いちぎん食堂** — 24小時在地食堂，沖繩家庭早餐
3. **三笠食堂** — 24小時食堂，招牌沖繩ちゃんぽん

### Day 4（恩納 → 名護）
1. **パン屋 水円** — 恩納海邊手作烘焙坊
2. **シーサイドドライブイン** — 1967年老字號美式早餐
3. **A&W 名護店** — 前往鳳梨園順路

### Day 5（恩納）
1. **Hawaiian Pancakes House Paanilani** — 恩納人氣夏威夷鬆餅
2. **シーサイドドライブイン** — Day 4 沒去可以今天去
3. **パン屋 水円** — 每日麵包不同，兩天都值得

### Day 6（那覇壺川）
1. **C&C BREAKFAST OKINAWA** — 那覇人氣早午餐（09:00開門，需延後出發）
2. **ポークたまごおにぎり本店** — Day 2 沒去必嘗
3. **いちぎん食堂** — 24小時營業

> 💡 早餐推薦已加在每天的「出發」項目下，點開即可看到詳細資訊','completed','2026-03-24 02:40:31');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (66,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成修改 ✅

### 調整內容

**1. 波上宮縮短為30分鐘**
- 時間：14:52-15:22（原 14:52-15:52）

**2. 瀨長島提前**
- 時間：15:37-17:37（原 16:07-18:07）

**3. 新增加油站（晚餐前）**
- 時間：17:47-18:02
- 位置：瀨長島往那霸方向國道 331 沿線
- 自助式（セルフ）較便宜，選「レギュラー」即可

**4. 晚餐改為那霸美居附近**
- 時間：18:17-19:17
- 推薦餐廳：
  - **ステーキハウス88 辻本店** — 1955年創業老牌牛排，¥1,500~，距飯店約5分鐘
  - **Jack''s Steak House** — 1953年創業，沖繩最古老牛排店，¥1,500~，距飯店約7分鐘
  - **琉球新麺 通堂 小禄本店** — 人氣拉麵（男味/女味），¥800~，距飯店約10分鐘

**5. 晚餐後行程移至備案**
- 沖繩 ASHIBINAA Outlet（含購物推薦）
- Can*Do 百元商店
- SPORTS DEPO 豐崎店
- 已寫入第六天備案，時間充裕可自行安排

**6. 還車時間調整**
- 時間：19:32-20:02
- 還車後搭單軌電車或計程車回飯店

### 新行程順序
出發 → 牧志市場 → 沖繩媳婦 → 午餐 → 玉泉洞 → 波上宮(30min) → 瀨長島 → **加油** → **晚餐(飯店附近)** → 還車 → 回飯店','completed','2026-03-24 10:41:32');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (67,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已更新加油站推薦 ✅

第六天的加油站已更新為**具體推薦**：

### 推薦加油地點
瀨長島回那霸的**國道 331（豊見城段）**，選**セルフ（自助式）**加油站最划算：

1. **豊見城市翁長～高安**（國道 331）— 瀨長島出來 5 分鐘，ENEOS・出光・コスモ等連鎖自助站密集，競爭激烈價格最便宜
2. **那霸市小禄**（國道 331 進那霸段）— 最後加油機會

### 實用提醒
- 選「**レギュラー**」普通汽油 +「**満タン**」加滿
- 自助式比全服務便宜約 ¥5-10/L
- 沖繩油價約 ¥165-175/L，加滿一次約 ¥4,000-5,000
- **6 天行程加這一次就夠**，不需每天加油（沖繩不大，全程約 300-400km）
- Google Maps 搜「セルフ ガソリンスタンド」可找最近自助站

### 還車流程
加滿油 → 晚餐 → 開車至沖繩旅毛（新都心）還車 → 搭單軌電車回那霸美居飯店 🚝','completed','2026-03-24 10:42:40');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (68,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已修正 ✅

第六天還車地點已改為**那霸美居飯店（壺川）**，不再跑新都心。

### 調整內容
- 還車地點：沖繩旅毛 → 那霸美居飯店取還車
- 還車時間：19:32-19:52（縮短為20分鐘，不用跑新都心）
- 晚餐後直接開車回美居還車，還完車直接回房休息
- 省去原本從新都心搭單軌電車/計程車回飯店的麻煩

輕鬆還車，最後一晚好好休息 😊','completed','2026-03-24 12:49:32');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (69,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成修改 ✅

還車已移至晚餐前，新順序：

1. 加油站（17:47-18:02）
2. **還車**（18:17-18:37）← 開車回飯店還車
3. **晚餐**（18:47-19:47）← 步行前往

### 調整內容
- 還車時間：18:17-18:37（原 19:32-19:52）
- 晚餐時間：18:47-19:47（原 18:17-19:17）
- 晚餐交通改為**步行約10分鐘**（原開車15分鐘）
- 餐廳推薦維持不變（ステーキハウス88、Jack''s Steak House、通堂拉麵），都在飯店步行可達範圍

加完油直接回飯店還車 → 輕鬆散步去吃最後一晚大餐 🚶','completed','2026-03-24 12:53:38');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (70,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','## AI 建議已更新

已依最新行程重新分析，更新了 AI 建議頁面。

### 新發現問題
- Day 7 退房交通仍標記開車（Day 6 已還車）
- Day 5 天氣資料未設定
- Day 3/5 多數景點缺少地圖連結
- Day 5 寶可夢中心 travel 34分鐘有誤
- Day 4/6 部分交通時間估算有誤
- Day 5 來客夢購物與午餐時間重疊

### 確認已修正 7 項
交通亂碼、Day 6 時序、購物超時、午餐時間、Day 5 label/date、Day 3 星期

前往網頁 AI 建議 可查看完整報告','completed','2026-03-24 13:01:50');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (71,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已依 AI 建議修復行程 ✅

### 已修正項目（5項）

1. **Day 7 退房交通** — 開車 → 計程車（Day 6 已還車）
2. **Day 5 寶可夢中心交通** — 開車 34 分鐘 → 步行（同商場內）
3. **Day 5 時間重疊** — 來客夢購物時間 10:48-13:48 與午餐 12:30 重疊，已調整購物至 10:48-12:30
4. **Day 5 國際通交通** — 步行 6 分鐘 → 開車約 30 分鐘（從來客夢到那霸）
5. **Day 2 BUZZ RESORT** — 住宿描述「恩納村」→「北谷町」

### 尚待處理的項目

以下建議項目較複雜，建議另送「改行程」請求處理：
- 🟡 Day 5 天氣資料未設定（weather 為 null）
- 🟡 Day 3 / Day 5 多個景點缺少地圖連結（location 為 null）
- 🟡 Day 4 鳳梨園→百年古家大家 交通時間偏短（2分鐘，實際約 8-10 分鐘）

### 低優先建議（參考即可）
- Day 5 寶可夢中心建議預留 1.5-2 小時（目前 1 小時）
- Day 3 青之洞浮潛提前 7 天預約
- Day 7 樂桃 LCC 航廈需搭接駁巴士，預留 20-30 分鐘','completed','2026-03-24 13:16:18');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (72,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已修正 Day 4 交通時間 ✅

**鳳梨園 → 百年古家大家**的交通時間已從 2 分鐘修正為 **10 分鐘**。

### 修改內容
- 鳳梨園（名護パイナップルパーク）→ 百年古家大家：車程 2分鐘 → **10分鐘**
- 後續所有景點時間順延 8 分鐘：
  - 午餐 11:28 → **11:36**
  - 美麗海水族館 12:54 → **13:02**
  - Shinmei Coffee 15:30 → **15:38**
  - 古宇利海洋塔 16:25 → **16:33**
  - 古宇利島 16:58 → **17:06**
  - 晚餐 19:27 → **19:35**
  - 返回住宿 20:55 → **21:03**

tp-check: 🟢 符合品質規則','completed','2026-03-24 13:37:46');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (73,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## AI 建議已更新

已依最新行程重新分析，更新了 AI 建議頁面。

### 本次更新重點

**高優先（3項）：**
- Day 3/5/6 多數景點缺少地圖連結（location 為 null）
- Day 5 天氣資料未設定
- Day 6 沖繩媳婦到カフェくるくま交通時間標記10分鐘，實際約25~30分鐘

**中優先（4項）：**
- Day 6 晚餐備註寫車程但已還車
- Day 5 行程近12小時偏滿
- Day 3 午餐缺少評分
- Day 2 BUZZ RESORT 地區描述有誤

**已確認修正（vs上一版）：**
- Day 7 退房交通改為計程車
- Day 5 寶可夢中心交通改為步行同商場
- Day 5 來客夢購物與午餐時段已修正

前往網頁的 AI 建議 區塊可查看完整報告','completed','2026-03-24 14:05:05');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (74,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 行程已更新 ✅

已完成以下修正：

### 1. 補齊地圖資訊（28 個景點）
- **Day 3** sort 0~6, 8 共 8 個景點已補上 location（Google Maps + Apple Maps 導航連結）
- **Day 5** sort 0~9 共 10 個景點已補上 location
- **Day 6** sort 0~9 共 10 個景點已補上 location

### 2. Day 5 天氣資料
- 已補上天氣設定：恩納→來客夢→國際通→那霸

### 3. Day 6 交通時間修正
- 沖繩媳婦 → カフェくるくま：10 分鐘 → **約 25~30 分鐘**

所有景點現在都可以在網頁上點擊導航按鈕了','completed','2026-03-24 14:38:36');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (75,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'lean.lean@gmail.com','## 車程時間已重新校正

所有景點已確認有完整 location 資料。針對 14 筆車程時間進行重新估算修正：

### Day 3（殘波岬・萬座毛）— 3 筆
- 前兼久漁港 → **殘波岬**：5分 → **20分**
- 業務超市 → **HOPE VILLA**：20分 → **10分**
- ザ・ビッグ → **VILLA自由活動**：15分 → **10分**

### Day 4（美麗海・古宇利）— 2 筆
- Shinmei Coffee → **古宇利タワー**：3分 → **15分**（需過古宇利大橋）
- 古宇利タワー → **古宇利島**：29分 → **5分**（同島內）

### Day 5（來客夢・國際通）— 3 筆
- HOPE VILLA → **Beach Club**：36分 → **15分**
- Beach Club → **來客夢**：步行同商場 → **開車約30分**（恩納→北中城 15km）
- 國際通 → **晚餐**：開車10分 → **步行5分**（同區域）

### Day 6（牧志・瀨長島）— 6 筆
- 牧志市場 → **沖繩媳婦**：25分 → **10分**
- カフェくるくま → **玉泉洞**：30分 → **8分**（同在南城）
- 玉泉洞 → **波上宮**：15分 → **30分**（南城→那覇）
- 波上宮 → **瀨長島**：10分 → **15分**
- 瀨長島 → **加油站**：15分 → **5分**
- 加油站 → **還車**：15分 → **12分**','completed','2026-03-24 14:49:12');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (76,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已修正 3 項問題 ✅

### 1. Day 6 晚餐備註：車程→步行/計程車
Day 6 已還車，3 間晚餐餐廳備註已修正：
- **ステーキハウス88 辻本店**：距飯店步行約15分鐘
- **Jack''s Steak House**：步行約20分鐘（或計程車約7分鐘）
- **琉球新麺 通堂 小禄本店**：計程車約10分鐘（或單軌壺川站→小禄站1站）

### 2. Day 3 午餐 rating 補上
読谷村午餐 entry 評分已補為 **4.1**（参考花織そば 4.2 與海人食堂 4.1）

### 3. Day 2 BUZZ RESORT 地區描述
目前資料已正確標示為「**北谷町美浜**」，未發現恩納村的錯誤描述。此問題可能已在先前的修正中處理完畢。','completed','2026-03-24 15:21:13');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (77,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## Day 1 機場→飯店交通已修正為單軌 ✅

### 修改內容
- **交通方式**：開車 → **ゆいレール（沖繩單軌電車）**
- **路線**：那覇空港駅 → 壺川駅（約12分鐘，260日圓）＋步行5分鐘到飯店
- **車程時間**：37分鐘 → **17分鐘**
- **飯店 Check in 時間**：23:09 → **22:07**（提早約1小時）

### 備註
已在景點備註補充單軌乘車資訊與票價建議（7人可考慮一日券800日圓更划算）。','completed','2026-03-24 15:21:39');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (78,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com',NULL,'processing','2026-03-25 01:55:31');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (79,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## AI 建議已更新

已重新掃描全部 7 天行程資料，更新 AI 建議卡片：

### 已解決的舊問題（已從高/中優先移除）
- Day 5 天氣資料 ✅
- Day 3 午餐評分 ✅
- Day 7 退房交通改計程車 ✅
- Day 5 寶可夢中心交通改步行 ✅
- Day 2 BUZZ RESORT 地區描述 ✅

### 新發現 / 仍待處理
- 🔴 **Day 6 全部景點缺少 location** — 導航按鈕無法使用
- 🔴 **Day 6 沖繩媳婦→カフェくるくま 交通描述仍為10分鐘**（實際約25~30分鐘）
- 🔴 **Day 3/4/5 多處 geocode 待驗證**
- 🟡 Day 5 行程偏滿（12小時）
- 🟡 Day 6 還車動線可優化
- 🟡 多個餐廳 category 標記有誤

請到行程頁面查看完整建議卡片。','completed','2026-03-25 01:56:12');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (80,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','## 板橋 vs 沖繩 天氣比較（7/29–8/2）

行程期間為 **7 月底～8 月初**，兩地都是盛夏：

### 板橋（新北市）
- **氣溫**：高溫 33–35°C、低溫 27–28°C
- **天氣**：午後雷陣雨機率高，濕度偏高
- **體感**：悶熱，出門建議備傘

### 沖繩
- **氣溫**：高溫 31–33°C、低溫 27–28°C
- **天氣**：進入颱風季，7 月底開始颱風機率上升
- **紫外線**：極強，務必防曬
- **注意**：沖繩沒有護國神山擋颱，輕颱就會影響活動（離島船停駛、國內線停飛）

### 颱風季提醒
8 月是沖繩颱風最頻繁的月份，建議：
- 出發前一週關注氣象預報
- 準備 1–2 個室內備案行程（如 DFS 購物、國際通逛街）
- 確認航班保險與改期政策

> 目前距離出發還有 4 個多月，**實際天氣預報建議出發前 7–10 天再確認**。','completed','2026-03-25 22:16:37');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (81,'okinawa-trip-2026-Ray','trip-edit',NULL,NULL,'lean.lean@gmail.com','今天是 2026/3/23，距離出發日（7/29）還有約 4 個月，還不在行程期間喔！

## 沖繩 7/29～8/2 歷史天氣參考

| 項目 | 數值 |
|------|------|
| 平均氣溫 | 28～32°C |
| 海水溫度 | 約 28°C |
| 降雨 | 午後短暫雷陣雨為主，通常 30 分鐘內結束 |
| 日照 | 日出約 06:00、日落約 19:20 |
| 紫外線 | 極強（SPF50+ 必備） |
| 颱風 | 7～8 月為颱風季，出發前一週留意氣象 |

## 建議
- 行程中每天的天氣預報會在**出發前一週**自動更新到行程表
- 目前先做好防曬和雨具準備即可

有其他問題歡迎用**問建議**繼續問 😊','completed','2026-03-25 22:17:48');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (82,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成：三間住宿聯絡方式補充

已為所有住宿卡片補上完整聯絡資訊：

### 1. 沖繩那霸美居飯店（Day 1、5、6）
- 地址：〒900-0025 沖縄県那覇市壺川3-3-19
- 電話：098-855-7111
- Email：H8725-RE@accor.com

### 2. BUZZ RESORT Chatan（Day 2）
- 地址：〒904-0414 沖縄県国頭郡恩納村前兼久258
- 電話：098-982-5337（受付 9:00~21:00）
- 官網聯絡：https://www.buzz-resort.com/contact

### 3. HOPE VILLA Onnason（Day 3、4）
- 地址：沖縄県国頭郡恩納村名嘉真2288-702
- 電話：050-5433-6654
- 官網：https://hopevilla-onnason.com/

> BUZZ RESORT 和 HOPE VILLA 的官網未公開 email，已附上官網聯絡頁面連結替代。','completed','2026-03-26 05:01:03');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (83,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成：移除飯店 Check-in 時間

已將所有飯店卡片中的 Check-in 時間資訊移除：

- **Day 1** 沖繩那霸美居飯店：移除「Day 1 Check in 23:09」
- **Day 2** BUZZ RESORT Chatan：移除「Day 2 Check in 01:04（翌日深夜）」
- **Day 3** HOPE VILLA Onnason：移除「Day 3 Check in 15:50」
- **Day 5** 沖繩那霸美居飯店：移除「Day 5 Check in 20:22」

Day 4、6 為「連住」標註，維持不變。飯店卡片現在只顯示地址、電話、聯絡方式。','completed','2026-03-26 10:48:53');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (84,'okinawa-trip-2026-HuiYun','trip-plan',NULL,NULL,'penyin@gmail.com','## 建議：買 FunPASS 美麗海系列 4合1

分析你們的行程，有 **4 個付費景點**都在 FunPASS 涵蓋範圍內：

| 景點 | 天數 | 個別票價（大人）|
|------|------|----------------|
| 名護鳳梨園 | Day 4 | ¥1,500 |
| 沖繩美麗海水族館 | Day 4 | ¥2,180 |
| 古宇利海洋塔 | Day 4 | ¥1,000 |
| 玉泉洞（沖繩世界） | Day 6 | ¥2,000 |
| **合計** | | **¥6,680** |

### 推薦方案：美麗海系列 4合1
- **價格**：大人 NT90（約 ¥4,800）、兒童 NT28
- **內容**：美麗海水族館 + 任選 3 景點
- **每人省約 ¥1,800+**

### 使用注意
- 首次使用後 **5 天內**要用完 → 你們 Day 4 用到 Day 6，間隔 2 天，完全沒問題
- 電子票 QR Code，手機出示即可，不用排隊買票
- 建議在 **Klook 或 KKday** 購買，有時比官網更便宜

### 結論
**強烈建議買！** 行程剛好完美對應 4合1 方案，每人省將近 ¥2,000，7 個人就省 ¥14,000。','completed','2026-03-26 10:49:25');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (85,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 需要補充資訊

你的訊息結尾是冒號，但沒有附上各飯店的訂房來源資訊。

目前行程共有 3 間飯店需要加上訂房來源：

| 天數 | 飯店 | 訂房來源 |
|------|------|----------|
| Day 1 | 沖繩那霸美居飯店 | ？ |
| Day 2 | BUZZ RESORT Chatan | ？ |
| Day 3~4 | HOPE VILLA Onnason | ？ |
| Day 5~6 | 沖繩那霸美居飯店 | ？ |

請用**改行程**重新送出，並附上每間飯店的訂房來源（例如：Agoda、Booking.com、Hotels.com、官網直訂等）。

> 範例：「幫我把飯店加上訂房來源：美居 Agoda、BUZZ Booking.com、HOPE VILLA 官網」','completed','2026-03-26 23:46:52');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (86,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','已完成！已在飯店卡片的詳細資訊中加上訂房來源：

| 天數 | 飯店 | 訂房來源 |
|------|------|----------|
| Day 1 | 沖繩那霸美居飯店 | Trip.com |
| Day 2 | BUZZ RESORT Chatan | Trip.com |
| Day 5 | 沖繩那霸美居飯店 | Booking.com |
| Day 6 | 沖繩那霸美居飯店 | Booking.com |

展開飯店卡片即可看到訂房來源資訊。','completed','2026-03-26 23:52:09');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (87,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已完成飯店資訊更新

已更新 Day 3~6 的飯店訂房來源與 note 格式：

| 天數 | 飯店 | 訂房來源 |
|------|------|----------|
| Day 3 | HOPE VILLA Onnason | Booking.com |
| Day 4 | HOPE VILLA Onnason | Booking.com |
| Day 5 | 沖繩那霸美居飯店 | Trip.com |
| Day 6 | 沖繩那霸美居飯店 | Trip.com |

### note 格式調整
每天飯店 note 已改為一類一行：
- Day 3：獨棟Villa / 有廚房可自炊
- Day 4：Villa連住免搬行李 / 出發前確認冰箱食材
- Day 5：回到那霸連住兩晚 / 可整理行李
- Day 6：連住第二晚 / 今天要還車','completed','2026-03-27 00:19:07');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (88,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'lean.lean@gmail.com','## 已完成飯店描述格式更新 ✅

已將 6 天飯店的 details 欄位從「｜」分隔改為**一類一行**：

| 天數 | 飯店 | 分行項目 |
|------|------|----------|
| Day 1 | 沖繩那霸美居飯店 | 地址、TEL、Email、訂房來源 |
| Day 2 | BUZZ RESORT Chatan | 地址、TEL、Web、訂房來源 |
| Day 3 | HOPE VILLA Onnason | 地址、TEL、Web、訂房來源 |
| Day 4 | HOPE VILLA Onnason | 地址、TEL、Web、連住、訂房來源 |
| Day 5 | 沖繩那霸美居飯店 | 地址、TEL、Email、訂房來源 |
| Day 6 | 沖繩那霸美居飯店 | 地址、TEL、Email、連住、訂房來源 |

### 修改內容
- **details 格式**：原本用「｜」連接所有資訊，現改為每類獨立一行
- **同步修復**：順便清除資料庫中的亂碼字元（U+FFFD）','completed','2026-03-27 00:56:24');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (89,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已新增午餐選項 ✅

已在 Day 2 午餐新增 **極味屋 沖縄パルコシティ店**：

- **類型**：洋食（鉄板漢堡排）
- **特色**：博多發祥名店，自己在鐵板上煎半熟漢堡排，外焦內嫩肉汁四溢
- **推薦**：伊萬里牛漢堡排，搭配多種醬料自由搭配
- **價位**：¥1,200~
- **位置**：PARCO CITY 3F
- **Google 評分**：4.2

> 小孩可以自己動手煎漢堡排，很適合親子同樂！','completed','2026-03-27 06:52:08');
INSERT OR IGNORE INTO trip_requests (id,trip_id,mode,title,body,submitted_by,reply,status,created_at) VALUES (90,'okinawa-trip-2026-HuiYun','trip-edit',NULL,NULL,'penyin@gmail.com','## 已更新波上宮備註 ✅

Day 6 波上宮的 note 已加上拍照提醒：

> **拍照提醒**：走「波之上臨海道路」（大橋），從橋上往回看，才能拍到波上宮蓋在懸崖上的震撼全景喔！

原本「從臨港道路拍神社崖壁全景最壯觀」的籠統說法已替換為更具體的路線指引。','completed','2026-03-28 01:00:33');

-- trip_permissions (was: permissions)
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (1,'lean.lean@gmail.com','*','admin');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (2,'lean.lean@gmail.com','okinawa-trip-2026-Ray','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (3,'lean.lean@gmail.com','okinawa-trip-2026-HuiYun','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (4,'penyin@gmail.com','okinawa-trip-2026-HuiYun','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (5,'lean.lean@gmail.com','busan-trip-2026-CeliaDemyKathy','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (6,'lean.lean@gmail.com','banqiao-trip-2026-Onion','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (7,'lean.lean@gmail.com','kyoto-trip-2026-MimiChu','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (8,'lean.lean@gmail.com','okinawa-trip-2026-AeronAn','member');
INSERT OR IGNORE INTO trip_permissions (id,email,trip_id,role) VALUES (9,'lean.lean@gmail.com','okinawa-trip-2026-RayHus','member');
