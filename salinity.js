var aoi =
  /* color: #d63000 */
  /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
  ee.Geometry.Polygon(
    [
      [
        [-40.40384448271022, -20.212920175954984],
        [-40.40384448271022, -20.370064065281447],
        [-40.190984375288345, -20.370064065281447],
        [-40.190984375288345, -20.212920175954984],
      ],
    ],
    null,
    false
  );

var water_mask = ee
  .Image("JRC/GSW1_3/GlobalSurfaceWater")
  .select("seasonality")
  .eq(12);

function maskS2clouds(image) {
  var qa = image.select("QA60");

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa
    .bitwiseAnd(cloudBitMask)
    .eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}

function addBands(img) {
  var SSS = img.expression(
    "139.566970 + (86.21318 * log (band2)) - (24.62518 * log (band4))",
    {
      //https://www.researchgate.net/publication/348379244_Estuary_zone_based_on_sea_level_salinity_in_Ciletuh_Bay_West_Java
      band2: img.select("B2"),
      band4: img.select("B4"),
    }
  );

  var SSSname = SSS.rename(["SSS"]);

  return img.addBands([SSSname]);
}

var s2_1 = ee
  .ImageCollection("COPERNICUS/S2_HARMONIZED")
  .filterDate("2023-06-29", "2023-06-30")
  .filterBounds(aoi)
  .map(maskS2clouds)
  .map(addBands)
  .sort("CLOUD_COVER", true)
  .first();

var palette = [
  "141bd7",
  "42b2ff",
  "44ffd3",
  "4cff72",
  "4fff39",
  "fdff15",
  "ffa013",
  "ff1b11",
];
var style_ndsi = { min: 0, max: 36, bands: ["SSS"], palette: palette };

var visSentinel = {
  min: 0,
  max: 0.3,
  bands: ["B4", "B3", "B2"],
};

Map.addLayer(s2_1.clip(aoi).updateMask(water_mask), style_ndsi, "NDSI");
Map.addLayer(s2_1.clip(aoi), visSentinel, "RGB (B4, B3, B2)");
Map.setOptions("SATELLITE");

var leftMap = ui.Map();
var rightMap = ui.Map();

var ndsi_img = ui.Map.Layer(s2_1.clip(aoi).updateMask(water_mask), style_ndsi);
var rgb_img = ui.Map.Layer(s2_1.clip(aoi), visSentinel);

var ndsi_layer = rightMap.layers();
var rgb_layer = leftMap.layers();

ndsi_layer.add(ndsi_img);
rgb_layer.add(rgb_img);

var ndsi_label = ui.Label("NDSI 2023-06-29");
ndsi_label.style().set("position", "bottom-right");

var rgb_label = ui.Label("RGB 2023-06-29");
rgb_label.style().set("position", "bottom-left");

leftMap.add(rgb_label);
rightMap.add(ndsi_label);

var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  orientation: "horizontal",
  wipe: true,
});

ui.root.clear();
ui.root.add(splitPanel);

var linkPanel = ui.Map.Linker([leftMap, rightMap]);
leftMap.centerObject(aoi, 13);
rightMap.setOptions("SATELLITE");
leftMap.setOptions("SATELLITE");
