// 素材接入登記表：買來的素材放進 yunyin/assets/，這裡統一 import 成 Vite 認得的 URL。
// 之後要加/換素材，只改這個檔和下面對應的資料表（buildings 的 img key、CROP_IMAGES）。
import hallImg from "../assets/buildings/hall.png";
import danfangImg from "../assets/buildings/danfang.png";
import barnImg from "../assets/buildings/barn.png";
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

export const BUILDING_IMAGES = { hall: hallImg, danfang: danfangImg, barn: barnImg };
export const TILE_IMAGES = { soil: soilImg };

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
};
