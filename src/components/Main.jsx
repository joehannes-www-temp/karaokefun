require('normalize.css/normalize.css');
require('styles/App.css');

import lyrics from '../sounds/por_jugar_al_amor__victor_estevez__lyrics.json';

import React from 'react';
import * as d3 from 'd3';
import * as Konva from 'konva';

let yeomanImage = require('../images/yeoman.png');

class AppComponent extends React.Component {
  constructor (...args) {
    super(...args);

    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.toggle = this.toggle.bind(this);
    this.playing = false;
  }
  render() {
    return (
      <div className="index">
          <audio id="audioElement" src="./sounds/por_jugar_al_amor__victor_estevez__instrumental.mp3"></audio>
          <div id="canvas"></div>
          <span id="activate" onClick={this.toggle}>
            <h1 id="title">{lyrics.artist} - {lyrics.title}</h1>
          </span>
      </div>
    );
  }
  componentWillMount() {
    this.played = [];
    this.paused = [];
  }
  componentDidMount() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.audioElement = document.getElementById('audioElement');
    this.audioSrc = this.audioCtx.createMediaElementSource(this.audioElement);
    this.analyser = this.audioCtx.createAnalyser();

    // Bind our analyser to the media element source.
    this.audioSrc.connect(this.analyser);
    this.audioSrc.connect(this.audioCtx.destination);
    
    this.spectrumLen = 200;
    this.frequencyData = new Uint8Array(this.spectrumLen);

    this.lyricsHeight = 500;
    this.svgHeight = 300;
    this.barPadding = 1;

    this.lyrics = d3.select("body").append('svg').attr('height', this.lyricsHeight).attr('width', document.body.clientWidth);
    this.svg = d3.select("body").append('svg').attr('height', this.svgHeight).attr('width', document.body.clientWidth);
    
    this.fontsize = 60;
    this.offset = 2 * this.fontsize;

    this.intro = this.convertToMS(lyrics.verses[0].start);//careful!

    this.lyrics.selectAll('text')
      .data([{
        start: 0,
        end: lyrics.verses[0].start,
        text: Math.round(this.intro / 1000)
      }].concat(lyrics.verses))
      .enter()
      .append('text')
      .text((d) => d.text)
      .style('fill', 'white')
      .style('font-size', this.fontsize + 'px')
      .style('text-anchor', 'middle')
      .style('opacity', (d, i) => 1 - (i + 1) * (i / 7))
      .each((d, i) => {
        d.current = (i == 0);
        d.next = (i == 1);
      })
      .attr('x', function (d, i) { 
        return document.body.clientWidth / 2 + 'px';
      })
      .attr('y', (d, i) => { return i * 2 * this.fontsize + this.offset + 'px'; });
  
    this.konvaStage = new Konva.Stage({
      container: 'canvas',
      width: document.body.clientWidth,
      height: document.body.clientHeight
    });
    this.konvaCircleLayer = new Konva.Layer();
    this.konvaBeamLayer = new Konva.Layer();

    this.konvaCircleEls = [];
    this.konvaBeamEls = [];
    
    this.renderChart();
  }
  convertToMS (time) {
    let t = time.split(':');
    return t[2] * 10 + t[1] * 1000 + t[0] * 1000 * 60;
  }
  play () {
    this.played.push(new Date().getTime());
    document.getElementById("audioElement").play();
  }
  pause () {
    this.paused.push(new Date().getTime());
    document.getElementById("audioElement").pause();
  }
  toggle (e) {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
    this.playing = !this.playing;
  }
  time() {
    let t = 0;
    let now = new Date().getTime();
    this.played.forEach((start, i) => {
      if (this.paused[i]) {
        t += this.paused[i] - start;
      } else {
        t += now - start;
      }
    });
    return t;
  }
  renderChart() {
    requestAnimationFrame(this.renderChart.bind(this));

    this.analyser.getByteFrequencyData(this.frequencyData);

    this.lyrics.attr('width', document.body.clientWidth);
    this.svg.attr('width', document.body.clientWidth);
  
    let time = this.time();
    let texts = this.lyrics.selectAll('text');
    let lyricsChange = false;
    let currentLyricsNr = 0;
    let that = this;
    let lyricsChangeTimeDiff = 0;

    texts.attr('x', function (d, i) { 
        return document.body.clientWidth / 2 + 'px';
      })

    texts.each(function (d, i) {
      if (d.current) {
        if (that.convertToMS(d.end) < time) {
          lyricsChange = true;
          currentLyricsNr = i;
          let diff = 1 - (time - that.convertToMS(d.end)) / time;
          lyricsChangeTimeDiff = (texts.data()[i + 1] ? that.convertToMS(texts.data()[i + 1].start) : time) - time;
        } else {
          that.konvaCircleLayer.visible(false);
        }
      }
      if (d.current && (d.start == 0 || d.interlude)) {
        //that.konvaStage.opacity(1);
        that.konvaCircleLayer.visible(true);
        that.drawKonva();
        d3.select(this).text(Math.round((that.convertToMS(d.end) - time) / 1000));
      }
      else {
        //that.drawKonva();
        //that.konvaStage.opacity(0);
        //that.konvaCircleLayer.visible(false);
      }
    });

    texts
      .style('fill', (d, i) => {
          if (d.current && i != 0 && this.convertToMS(d.start) < time) {
           let white = Math.round(this.frequencyData.reduce((p, c) => p + c) / this.frequencyData.length);
           return 'rgb(256, ' + white + ', ' + white + ')';
         }
         else {
          return 'rgb(256,256,256)';
         }
      });

    if (lyricsChange) {
      let _t = d3.transition().duration(lyricsChangeTimeDiff).ease(d3.easeLinear);
      texts
        .transition(_t)
        .attr('y', (d, i) => {
          let j;
          d.weight = 'normal';
          if (d.current && this.convertToMS(d.end) < time) {
            d.current = false;
            d.opacity = 0;
            let t = texts.data();
            if (t[i + 1]) {
              t[i + 1].current = true;
            }
            if (t[i + 2]) {
              t[i + 1].next = false;
              t[i + 2].next = true;
            }
            j = -1;
          } else if (d.current && this.convertToMS(d.end) > time) {
            j = 0;
            d.opacity = 1;
            d.weight = 'bold';
            d.fillColor = 'red';
            if (d.start == 0 || d.interlude) {
              d.text = Math.round((this.convertToMS(d.end) - time) / 1000);
            }
          } else if (d.next) {
            j = 1;
            d.opacity = .5;
          } else {
            j = i - currentLyricsNr;
            d.opacity = 0;
          }
          return (j * 2) * this.fontsize + this.offset + 'px'; 
        })
        .style('opacity', (d, i) => { return d.opacity })
        .style('font-weight', (d) => { return d.weight; })
        .style('fill', (d) => { return d.fillColor; })
        .text((d) => { return d.text; });
    }

    this.svg.selectAll('rect')
      .data(this.frequencyData)
      .enter()
       .append('rect')
       .attr('x', (d, i) => {
          return Math.round(i * (document.body.clientWidth / this.frequencyData.length));
       })
       .attr('width', Math.round(document.body.clientWidth / this.frequencyData.length - this.barPadding))
    
    this.svg.selectAll('rect')
      .attr('y', (d) => {
         return this.svgHeight - d;
      })
      .attr('height', function(d) {
         return d;
      })
      .attr('fill', function(d) {
         return 'rgb(' + d + ', 0, 0)';
      });
  }
  drawKonva () {
    for (let len = this.frequencyData.length, i = 0; i < len; i++) {
      if (this.konvaCircleEls[i]) {
        let c = this.konvaCircleEls[i];
        let r = 125 + this.frequencyData[i];
        c.x(Math.cos(360 / len * i) * r + document.body.clientWidth / 2);
        c.y(Math.sin(360 / len * i) * r + document.body.clientHeight / 2);
        c.radius(Math.round(Math.round(Math.random() * r) / 10));
      } else {
        let r = 125;
        let circle = new Konva.Circle({
          x: Math.cos(360 / len * i) * r + document.body.clientWidth / 2,
          y: Math.sin(360 / len * i) * r + document.body.clientHeight / 2,
          radius: Math.round(Math.round(Math.random() * r) / 10),
          fill: 'rgb(' + Math.round(Math.random() * 256) + ', 0, 0)',
          strokeWidth: 0,
          opacity: Math.round(Math.random() * 100) / 100,
          shadowColor: 'rgb(' + Math.round(Math.random() * 256) + ', 256, 256)',
          shadowBlur: Math.round(Math.random * 25),
          shadowOpacity: Math.round(Math.random() / 2)
        });
        this.konvaCircleEls.push(circle);
        this.konvaCircleLayer.add(circle);
        this.konvaStage.add(this.konvaCircleLayer);
      }
    }
    this.konvaCircleLayer.draw();
  }
}

AppComponent.defaultProps = {
  d3
};

export default AppComponent;
