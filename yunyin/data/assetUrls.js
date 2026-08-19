// 素材接入登記表：買來的素材放進 yunyin/assets/，這裡統一 import 成 Vite 認得的 URL。
// 之後要加/換素材，只改這個檔和下面對應的資料表（buildings 的 img key、CROP_IMAGES）。
import hallImg from "../assets/buildings/hall.png";
import danfangImg from "../assets/buildings/danfang.png";
import barnImg from "../assets/buildings/barn.png";
import playerCountryHomeImg from "../assets/buildings/home_player_country.png";
import residentModernHomeImg from "../assets/buildings/home_resident_modern.png";
import residentJapaneseHomeImg from "../assets/buildings/home_resident_japanese.png";
import residentOneStoryHomeImg from "../assets/buildings/home_resident_one_story.png";
import soilImg from "../assets/tiles/soil.png";
import terrainSheetImg from "../assets/tiles/terrain-sheet.png";
import oakGreenImg from "../assets/trees/oak_green.png";
import oakGreenSmallImg from "../assets/trees/oak_green_small.png";
import pineGreenImg from "../assets/trees/pine_green.png";
import tuft1 from "../assets/decor/tuft_1.png";
import tuft2 from "../assets/decor/tuft_2.png";
import tuft3 from "../assets/decor/tuft_3.png";
import tuft4 from "../assets/decor/tuft_4.png";
import tuft5 from "../assets/decor/tuft_5.png";
import tuft6 from "../assets/decor/tuft_6.png";
import tuft7 from "../assets/decor/tuft_7.png";
import tuft8 from "../assets/decor/tuft_8.png";
import tuft9 from "../assets/decor/tuft_9.png";
import tuft10 from "../assets/decor/tuft_10.png";
import tuft11 from "../assets/decor/tuft_11.png";
import plazaFountainImg from "../assets/decor/plaza_fountain.png";
import plazaBenchImg from "../assets/decor/plaza_bench.png";
import stationCounterImg from "../assets/decor/station_counter.png";
import stationShelfImg from "../assets/decor/station_shelf.png";
import stationFurnaceImg from "../assets/decor/station_furnace.png";
import hallAltarImg from "../assets/decor/hall_altar.png";
import hallCushionImg from "../assets/decor/hall_cushion.png";
import hallTatamiImg from "../assets/decor/hall_tatami.png";
import hallScrollImg from "../assets/decor/hall_scroll.png";
import stationStallImg from "../assets/decor/station_stall.png";
import shopShelfTallImg from "../assets/decor/shop_shelf_tall.png";
import decorBonsaiAImg from "../assets/decor/decor_bonsai_a.png";
import decorBonsaiBImg from "../assets/decor/decor_bonsai_b.png";
import decorMatImg from "../assets/decor/decor_mat.png";
// 戶外造景（Modern Exteriors：Garden / Camping 主題）
import gatePillarImg from "../assets/decor/gate_pillar.png";
import gatePillarBrokenImg from "../assets/decor/gate_pillar_broken.png";
import farmRockAImg from "../assets/decor/farm_rock_a.png";
import farmRockBImg from "../assets/decor/farm_rock_b.png";
import farmMushroomAImg from "../assets/decor/farm_mushroom_a.png";
import farmMushroomBImg from "../assets/decor/farm_mushroom_b.png";
import farmWoodpileImg from "../assets/decor/farm_woodpile.png";
import farmLanternImg from "../assets/decor/farm_lantern.png";
import hallPillarImg from "../assets/decor/hall_pillar.png";
import hallIncenseImg from "../assets/decor/hall_incense.png";
import roomWallsSheet from "../assets/tiles/room_walls.png";
import roomFloorsSheet from "../assets/tiles/room_floors.png";
import furnitureBedSingleImg from "../assets/furniture/bed_single.png";
import furnitureTableWoodImg from "../assets/furniture/table_wood.png";
import furnitureChairWoodImg from "../assets/furniture/chair_wood.png";
import furnitureCabinetWoodImg from "../assets/furniture/cabinet_wood.png";
import furnitureRugRoundImg from "../assets/furniture/rug_round.png";
import furnitureBedDoubleImg from "../assets/furniture/bed_double.png";
import furnitureDeskStudyImg from "../assets/furniture/desk_study.png";
import furnitureChairWoodLeftImg from "../assets/furniture/chair_wood_left.png";
import furnitureSofaLongImg from "../assets/furniture/sofa_long.png";
import furnitureBookshelfTallImg from "../assets/furniture/bookshelf_tall.png";
import furnitureWardrobeTallImg from "../assets/furniture/wardrobe_tall.png";
import furniturePlantBigImg from "../assets/furniture/plant_big.png";
import furniturePlantSmallImg from "../assets/furniture/plant_small.png";
import furnitureFloorLampImg from "../assets/furniture/floor_lamp.png";
import furnitureRugWovenImg from "../assets/furniture/rug_woven.png";
import furnitureGrandPianoImg from "../assets/furniture/grand_piano.png";
import furnitureKotatsuImg from "../assets/furniture/kotatsu.png";
import furnitureGoldHarpImg from "../assets/furniture/gold_harp.png";
import furnitureBedGuestImg from "../assets/furniture/bed_guest.png";
import furnitureArtPaintingImg from "../assets/furniture/art_painting.png";
import furnitureAntiqueVaseImg from "../assets/furniture/antique_vase.png";
import furnitureFireplaceImg from "../assets/furniture/fireplace.png";
import furnitureGrandfatherClockImg from "../assets/furniture/grandfather_clock.png";
import furnitureArtEaselImg from "../assets/furniture/art_easel.png";
import furnitureKitchenStoveImg from "../assets/furniture/kitchen_stove.png";
import furnitureKitchenStoveGasImg from "../assets/furniture/kitchen_stove_gas.png";
import furnitureKitchenOvenImg from "../assets/furniture/kitchen_oven.png";
import furnitureKitchenSinkImg from "../assets/furniture/kitchen_sink.png";
import furnitureKitchenFridgeImg from "../assets/furniture/kitchen_fridge.png";
import furnitureBathWashstandImg from "../assets/furniture/bath_washstand.png";
import furnitureBathToiletImg from "../assets/furniture/bath_toilet.png";
import furnitureBathMirrorImg from "../assets/furniture/bath_mirror.png";
import furnitureBathTubImg from "../assets/furniture/bath_tub.png";
import furnitureBathWasherImg from "../assets/furniture/bath_washer.png";
import furnitureGymTreadmillImg from "../assets/furniture/gym_treadmill.png";
import furnitureGymBallImg from "../assets/furniture/gym_ball.png";
import furnitureGymRackImg from "../assets/furniture/gym_rack.png";
import furnitureGymPlatesImg from "../assets/furniture/gym_plates.png";
import furnitureAquariumImg from "../assets/furniture/aquarium.png";
import furnitureParasolImg from "../assets/furniture/parasol.png";
import furnitureBenchWoodImg from "../assets/furniture/bench_wood.png";
import furnitureArcadeMachineImg from "../assets/furniture/arcade_machine.png";
import furnitureShelfRackImg from "../assets/furniture/shelf_rack.png";
import furniturePoolTableImg from "../assets/furniture/pool_table.png";
import furnitureTvFlatImg from "../assets/furniture/tv_flat.png";
import furnitureArmchairImg from "../assets/furniture/armchair.png";
import furnitureMirrorFullImg from "../assets/furniture/mirror_full.png";
import furnitureCoatRackImg from "../assets/furniture/coat_rack.png";
import furniturePlantPotImg from "../assets/furniture/plant_pot.png";
import furnitureBedWoodWarmImg from "../assets/furniture/bed_wood_warm.png";
import furnitureBedGreenImg from "../assets/furniture/bed_green.png";
import furnitureBedDoubleGreenImg from "../assets/furniture/bed_double_green.png";
import furnitureBedDoublePurpleImg from "../assets/furniture/bed_double_purple.png";
import furnitureFutonJpImg from "../assets/furniture/futon_jp.png";
import furnitureTableDiningLongImg from "../assets/furniture/table_dining_long.png";
import furnitureTableLowJpImg from "../assets/furniture/table_low_jp.png";
import furnitureTableConsoleImg from "../assets/furniture/table_console.png";
import furnitureTableCoffeeImg from "../assets/furniture/table_coffee.png";
import furnitureTableConferenceImg from "../assets/furniture/table_conference.png";
import furnitureChairYellowImg from "../assets/furniture/chair_yellow.png";
import furnitureChairGreenImg from "../assets/furniture/chair_green.png";
import furnitureChairBlueImg from "../assets/furniture/chair_blue.png";
import furnitureChairRedImg from "../assets/furniture/chair_red.png";
import furnitureStoolBarBlueImg from "../assets/furniture/stool_bar_blue.png";
import furnitureStoolBarRedImg from "../assets/furniture/stool_bar_red.png";
import furnitureStoolWoodImg from "../assets/furniture/stool_wood.png";

import qinglingSeed from "../assets/crops/qingling_Seed.png";
import qinglingSprout from "../assets/crops/qingling_Sprout.png";
import qinglingStage1 from "../assets/crops/qingling_Stage_1.png";
import qinglingRipe from "../assets/crops/qingling_Ripe.png";
import yuehuaSeed from "../assets/crops/yuehua_Seed.png";
import yuehuaSprout from "../assets/crops/yuehua_Sprout.png";
import yuehuaStage1 from "../assets/crops/yuehua_Stage_1.png";
import yuehuaRipe from "../assets/crops/yuehua_Ripe.png";
import xingluSeed from "../assets/crops/xinglu_Seed.png";
import xingluSprout from "../assets/crops/xinglu_Sprout.png";
import xingluStage1 from "../assets/crops/xinglu_Stage_1.png";
import xingluRipe from "../assets/crops/xinglu_Ripe.png";
import lingmuSeed from "../assets/crops/lingmu_Seed.png";
import lingmuSprout from "../assets/crops/lingmu_Sprout.png";
import lingmuStage1 from "../assets/crops/lingmu_Stage_1.png";
import lingmuRipe from "../assets/crops/lingmu_Ripe.png";

export const BUILDING_IMAGES = {
  hall: hallImg,
  danfang: danfangImg,
  barn: barnImg,
  playerCountryHome: playerCountryHomeImg,
  residentModernHome: residentModernHomeImg,
  residentJapaneseHome: residentJapaneseHomeImg,
  residentOneStoryHome: residentOneStoryHomeImg,
  // 室內互動站（building 形式：走到門口格開面板）
  stationCounter: stationCounterImg,
  stationShelf: stationShelfImg,
  stationFurnace: stationFurnaceImg,
  stationStall: stationStallImg,
  hallAltar: hallAltarImg,
};
export const TILE_IMAGES = { soil: soilImg };
// 室內牆/地板圖集（Room_Builder）：rect = [sx, sy, w, h]
export const INTERIOR_SHEETS = { walls: roomWallsSheet, floors: roomFloorsSheet };
export const INTERIOR_RECTS = {
  wallTop: [512, 32, 32, 32],  // 木板牆・純牆體（側牆/上牆通用）
  wallFace: [384, 32, 32, 32], // 木板牆・牆面帶踢腳線
  floorWood: [160, 160, 32, 32], // 米色木格地板（無縫中央塊）
};

export const WORLD_DECOR_IMAGES = {
  plazaFountain: plazaFountainImg,
  plazaBench: plazaBenchImg,
  hallCushion: hallCushionImg,
  hallTatami: hallTatamiImg,
  hallScroll: hallScrollImg,
  shopShelfTall: shopShelfTallImg,
  decorBonsaiA: decorBonsaiAImg,
  decorBonsaiB: decorBonsaiBImg,
  decorMat: decorMatImg,
  hallPillar: hallPillarImg,
  hallIncense: hallIncenseImg,
  gatePillar: gatePillarImg,
  gatePillarBroken: gatePillarBrokenImg,
  farmRockA: farmRockAImg,
  farmRockB: farmRockBImg,
  farmMushroomA: farmMushroomAImg,
  farmMushroomB: farmMushroomBImg,
  farmWoodpile: farmWoodpileImg,
  farmLantern: farmLanternImg,
};

// 家具圖片：key 對應 furnitureCatalog 的 furniture id（沒登記的家具走色塊 fallback）。
export const FURNITURE_IMAGES = {
  starter_bed: furnitureBedSingleImg,
  starter_table: furnitureTableWoodImg,
  starter_chair: furnitureChairWoodImg,
  starter_cabinet: furnitureCabinetWoodImg,
  starter_rug: furnitureRugRoundImg,
  double_bed: furnitureBedDoubleImg,
  study_desk: furnitureDeskStudyImg,
  chair_wood_left: furnitureChairWoodLeftImg,
  long_sofa: furnitureSofaLongImg,
  bookshelf: furnitureBookshelfTallImg,
  tall_wardrobe: furnitureWardrobeTallImg,
  plant_big: furniturePlantBigImg,
  plant_small: furniturePlantSmallImg,
  floor_lamp: furnitureFloorLampImg,
  woven_rug: furnitureRugWovenImg,
  grand_piano: furnitureGrandPianoImg,
  kotatsu: furnitureKotatsuImg,
  gold_harp: furnitureGoldHarpImg,
  guest_bed: furnitureBedGuestImg,
  art_painting: furnitureArtPaintingImg,
  antique_vase: furnitureAntiqueVaseImg,
  fireplace: furnitureFireplaceImg,
  grandfather_clock: furnitureGrandfatherClockImg,
  art_easel: furnitureArtEaselImg,
  kitchen_stove: furnitureKitchenStoveImg,
  kitchen_stove_gas: furnitureKitchenStoveGasImg,
  kitchen_oven: furnitureKitchenOvenImg,
  kitchen_sink: furnitureKitchenSinkImg,
  kitchen_fridge: furnitureKitchenFridgeImg,
  bath_washstand: furnitureBathWashstandImg,
  bath_toilet: furnitureBathToiletImg,
  bath_mirror: furnitureBathMirrorImg,
  bath_tub: furnitureBathTubImg,
  bath_washer: furnitureBathWasherImg,
  gym_treadmill: furnitureGymTreadmillImg,
  gym_ball: furnitureGymBallImg,
  gym_rack: furnitureGymRackImg,
  gym_plates: furnitureGymPlatesImg,
  aquarium: furnitureAquariumImg,
  parasol: furnitureParasolImg,
  bench_wood: furnitureBenchWoodImg,
  arcade_machine: furnitureArcadeMachineImg,
  shelf_rack: furnitureShelfRackImg,
  pool_table: furniturePoolTableImg,
  tv_flat: furnitureTvFlatImg,
  armchair: furnitureArmchairImg,
  mirror_full: furnitureMirrorFullImg,
  coat_rack: furnitureCoatRackImg,
  plant_pot: furniturePlantPotImg,
  bed_wood_warm: furnitureBedWoodWarmImg,
  bed_green: furnitureBedGreenImg,
  bed_double_green: furnitureBedDoubleGreenImg,
  bed_double_purple: furnitureBedDoublePurpleImg,
  futon_jp: furnitureFutonJpImg,
  table_dining_long: furnitureTableDiningLongImg,
  table_low_jp: furnitureTableLowJpImg,
  table_console: furnitureTableConsoleImg,
  table_coffee: furnitureTableCoffeeImg,
  table_conference: furnitureTableConferenceImg,
  chair_yellow: furnitureChairYellowImg,
  chair_green: furnitureChairGreenImg,
  chair_blue: furnitureChairBlueImg,
  chair_red: furnitureChairRedImg,
  stool_bar_blue: furnitureStoolBarBlueImg,
  stool_bar_red: furnitureStoolBarRedImg,
  stool_wood: furnitureStoolWoodImg,
};

// 地形拼接圖（1_Terrains_32x32.png）沒有裁好的單張草地/土路，直接從整張圖裁子矩形來用。
// rect: [sx, sy, sw, sh]，座標是「安全區」——blob 貼圖圓角處露出的純色底，不會踩到花紋邊緣。
export const TERRAIN_SHEET = terrainSheetImg;
export const TERRAIN_RECTS = {
  grass: [96, 64, 32, 32],    // 純色格（tile 3,2）；草地紋理感靠 GRASS_TUFTS 疊加，不是靠這格本身
};

// 土路的九宮格邊緣拼接（3×3 minimal blob，對應 Godot autotile 格式）：
// 角/邊/中心九塊，邊跟中心可以沿方向重複延伸，畫出圓角草地融合的效果。
// 座標從 terrain-sheet.png 左上角第一個 blob 範例（圓角方塊）精確量出。
export const PATH_BLOB = {
  TL: [0, 0, 32, 32], T: [32, 0, 32, 32], TR: [64, 0, 32, 32],
  L: [0, 32, 32, 32], C: [32, 32, 32, 32], R: [64, 32, 32, 32],
  BL: [0, 64, 32, 32], B: [32, 64, 32, 32], BR: [64, 64, 32, 32],
};

export const TREE_IMAGES = [oakGreenImg, oakGreenSmallImg, pineGreenImg];

// 草地是純平塗底色，紋理感要靠這些草叢/小花裝飾疏疏落落蓋上去（草地本身沒有花紋）
export const GRASS_TUFTS = [tuft1, tuft2, tuft3, tuft4, tuft5, tuft6, tuft7, tuft8, tuft9, tuft10, tuft11];

// 陣列索引對應 plotStage()：0 種／1 芽／2 長／3 熟
export const CROP_IMAGES = {
  qingling: [qinglingSeed, qinglingSprout, qinglingStage1, qinglingRipe],
  yuehua: [yuehuaSeed, yuehuaSprout, yuehuaStage1, yuehuaRipe],
  xinglu: [xingluSeed, xingluSprout, xingluStage1, xingluRipe],
  lingmu: [lingmuSeed, lingmuSprout, lingmuStage1, lingmuRipe],
};
