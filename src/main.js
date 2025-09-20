import { Map, View } from 'ol';
import Control from 'ol/control/Control';
import Feature from 'ol/Feature';
import GPX from 'ol/format/GPX';
import Point from 'ol/geom/Point';
import { circular } from 'ol/geom/Polygon';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Icon, Stroke, Style } from 'ol/style';
import kompas from 'kompas';
import './style.css';

const createRecorder = (map) => {
  let isRecording = false;
  let positions = [];

  const recordBtn = document.createElement('div');
  recordBtn.className = 'ol-control ol-unselectable record';
  recordBtn.innerHTML = '<button title="Record">●</button>';

  recordBtn.addEventListener('click', function () {
    isRecording = !isRecording;

    if (isRecording) {
      recordBtn.classList.add('recording');
    } else {
      recordBtn.classList.remove('recording');
      console.log('Recorded positions:', positions);
      positions = [];
    }
  });

  map.addControl(new Control({ element: recordBtn }));

  return (pos) => {
    if (isRecording) {
      positions.push(pos);
    }

    console.log('recorder', pos);
  };
};

const createCurrentPositionLayer = (map) => {
  const source = new VectorSource();
  const layer = new VectorLayer({
    source: source,
  });

  const locate = document.createElement('div');
  locate.className = 'ol-control ol-unselectable locate';
  locate.innerHTML = '<button title="Locate me">◎</button>';
  locate.addEventListener('click', function () {
    if (!source.isEmpty()) {
      map.getView().fit(source.getExtent(), {
        maxZoom: 18,
        duration: 500,
      });
    }
  });

  map.addControl(new Control({ element: locate }));

  const style = new Style({
    fill: new Fill({
      color: 'rgba(0, 0, 255, 0.2)',
    }),
    image: new Icon({
      src: './data/location-heading.svg',
      rotateWithView: true,
    }),
  });

  layer.setStyle(style);

  function startCompass() {
    kompas()
      .watch()
      .on('heading', function (heading) {
        style.getImage().setRotation((Math.PI / 180) * heading);
      });
  }

  if (
    window.DeviceOrientationEvent &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    locate.addEventListener('click', function () {
      DeviceOrientationEvent.requestPermission()
        .then(startCompass)
        .catch(function (error) {
          alert(`ERROR: ${error.message}`);
        });
    });
  } else if ('ondeviceorientationabsolute' in window) {
    startCompass();
  } else {
    alert('No device orientation provided by device');
  }

  return layer;
};

const createInfoLayer = (map) => {
  const info = document.createElement('div');
  info.className = 'ol-control ol-unselectable info';
  info.innerHTML = 'My Location';

  map.addControl(new Control({ element: info }));

  return new VectorLayer({
    source: new VectorSource(),
    properties: {
      updatePosition: (pos) => {
        info.innerHTML = `
          Long: ${pos.coords.longitude.toFixed(6)} |
          Lat: ${pos.coords.latitude.toFixed(6)}
          (±${pos.coords.accuracy} m)<br/>
          Altitude: ${pos.coords.altitude
            ? pos.coords.altitude.toFixed(2) + ` m${pos.coords.altitudeAccuracy ? `${pos.coords.altitudeAccuracy} m` : ''}`
            : 'N/A'
          }<br/>
          Heading: ${pos.coords.heading ? pos.coords.heading.toFixed(2) + '°' : 'N/A'}<br/>
          Speed: ${pos.coords.speed ? pos.coords.speed.toFixed(2) + ' m/s' : 'N/A'}<br/>
        `;
      },
    },
  });
};

const createMap = () => new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: fromLonLat([0, 0]),
    zoom: 10,
  }),
});

const main = () => {
  const map = createMap();
  const infoLayer = createInfoLayer(map);
  const currentPositionLayer = createCurrentPositionLayer(map);
  const recorder = createRecorder(map);

  map.addLayer(currentPositionLayer);
  map.addLayer(infoLayer);

  const updatePosition = (pos) => {
    recorder(pos);
    infoLayer.get('updatePosition')(pos);

    const coords = [pos.coords.longitude, pos.coords.latitude];
    const accuracy = circular(coords, pos.coords.accuracy);
    const source = currentPositionLayer.getSource();

    source.clear(true);
    source.addFeatures([
      new Feature(
        accuracy.transform('EPSG:4326', map.getView().getProjection()),
      ),
      new Feature(new Point(fromLonLat(coords))),
    ]);

    map.getView().fit(source.getExtent(), {
      maxZoom: 18,
      duration: 500,
    });
  };

  const handlePositionError = (error) => {
    alert(`ERROR: ${error.message}`);
  };

  navigator.geolocation.watchPosition(updatePosition, handlePositionError, {
    enableHighAccuracy: true,
  });

  // navigator.geolocation.getCurrentPosition(updatePosition, handlePositionError, {
  //   enableHighAccuracy: true,
  // });

  /////

  // const style2 = {
  //   'Point': new Style({
  //     image: new CircleStyle({
  //       fill: new Fill({
  //         color: 'rgba(255,255,0,0.4)',
  //       }),
  //       radius: 5,
  //       stroke: new Stroke({
  //         color: '#ff0',
  //         width: 1,
  //       }),
  //     }),
  //   }),
  //   'LineString': new Style({
  //     stroke: new Stroke({
  //       color: '#f00',
  //       width: 3,
  //     }),
  //   }),
  //   'MultiLineString': new Style({
  //     stroke: new Stroke({
  //       color: '#0f0',
  //       width: 3,
  //     }),
  //   }),
  // };

  // const gpxVector = new VectorLayer({
  //   source: new VectorSource({
  //     url: './data/cantabria-asturias-1.gpx',
  //     format: new GPX(),
  //   }),
  //   style: function (feature) {
  //     return style2[feature.getGeometry().getType()];
  //   },
  // });

  // map.addLayer(gpxVector);
};

window.addEventListener('load', main);
