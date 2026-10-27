/* Original P Atlas aura. No React Bits code or licensed assets are used. */
(() => {
  'use strict';
  const vertex = `
    attribute vec2 position;
    varying vec2 uv;
    void main() { uv = position; gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const dither = `
    float pixelNoise() {
      // Fixed, one-pixel noise breaks quantization steps without temporal sparkle.
      return fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))) - 0.5;
    }
    vec3 quantizeSmoothly(vec3 color, float stepSize) {
      float signal = max(color.r, max(color.g, color.b));
      float coverage = smoothstep(0.0, 1.0 / 255.0, signal);
      return clamp(color + pixelNoise() * stepSize * coverage, 0.0, 1.0);
    }
  `;
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 uv;
    uniform float time;
    uniform vec2 rotation;
    uniform vec3 ice;
    uniform vec3 violet;
    uniform vec3 deep;
    uniform float sampleCount;
    uniform vec4 pulseAges[9];
    uniform vec4 focusSource;
    uniform float quantizationStep;
    ${dither}
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.13, 0.37, 0.71));
      p *= 7.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float terrainNoise(vec3 p) {
      vec3 cell = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      float lower = mix(mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), u.x),
                        mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), u.x), u.y);
      float upper = mix(mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), u.x),
                        mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), u.x), u.y);
      return mix(lower, upper, u.z) * 2.0 - 1.0;
    }
    mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
    vec3 orient(vec3 p) {
      p.yz = turn(rotation.x) * p.yz;
      p.xz = turn(rotation.y) * p.xz;
      return p;
    }
    float mistTime;
    float rippleAt(vec3 point) {
      vec3 flow = normalize(vec3(0.45, 0.85, -0.06));
      float bend = 0.22 * dot(point.xy, point.xy);
      float phase = (dot(point, flow) + bend) * 11.5 - mistTime * 1.15
                  + 0.55 * sin(point.x * 2.0 + point.z * 1.5);
      return sin(phase);
    }
    float densityAt(vec3 point) {
      // Restore the continuous volume; ripples advect and compress the fog itself.
      // Broad curved wavefronts travel through it, without a central point source.
      vec3 flow = normalize(vec3(0.45, 0.85, -0.06));
      float ripple = rippleAt(point);
      vec3 q = point + flow * (ripple * 0.070)
             + vec3(-0.018, 0.012, 0.015)
               * sin(dot(point, vec3(-0.70, 0.30, 0.65)) * 6.6 + mistTime * 0.70);
      q += 0.18 * sin(point.zxy * 2.6
                 + vec3(mistTime * 0.22, -mistTime * 0.19, mistTime * 0.16));
      float folds = sin(q.x * 3.8 + sin(q.z * 2.2 - mistTime * 0.30))
                  * cos(q.y * 3.0 + mistTime * 0.35);
      float swell = sin(dot(q, vec3(-0.45, 0.75, 0.55)) * 6.1 - mistTime * 0.60);
      float drift = sin(dot(q, vec3(0.65, 0.25, -0.70)) * 2.5 + mistTime * 0.24);
      float cloud = smoothstep(-0.30, 0.95, folds + swell * 0.55 + drift * 0.28);
      float radius = length(point) + 0.025 * sin(q.x * 4.0 + q.y * 3.0 - mistTime * 0.42);
      float boundary = 1.0 - smoothstep(0.87, 1.08, radius);
      return (cloud * 1.65 + 0.025) * boundary * (0.67 + ripple * 0.33);
    }
    vec2 ringDistance(vec3 surface, vec3 source, vec2 offset) {
      float distanceOnSphere = atan(length(cross(surface, source)), dot(surface, source));
      vec3 axisU = normalize(cross(source, vec3(0.0, 1.0, 0.0)));
      vec3 axisV = cross(source, axisU);
      float azimuth = atan(dot(surface, axisV), dot(surface, axisU) + 0.000001);
      // A closed circular noise domain has no azimuth seam. Broad terrain folds,
      // smaller coves and fine bends replace the repeating harmonic lobes.
      vec2 circle = vec2(cos(azimuth), sin(azimuth));
      vec2 terrain = circle + 0.12 * vec2(
        terrainNoise(vec3(circle * 1.7 + offset, time * 0.035)),
        terrainNoise(vec3(circle * 1.7 + offset + vec2(5.2, 9.1), time * 0.030)));
      terrain += offset;
      float folds = 0.210 * terrainNoise(vec3(terrain * 3.0, distanceOnSphere * 0.22 - time * 0.020))
                  + 0.075 * terrainNoise(vec3(terrain * 7.0 + vec2(13.5, -4.2), distanceOnSphere * 0.18 + time * 0.025))
                  + 0.025 * terrainNoise(vec3(terrain * 13.0 + vec2(-7.1, 12.3), distanceOnSphere * 0.12 - time * 0.018));
      // Slow radial changes preserve nested, outward-moving fronts while each
      // larger ring develops more contour detail away from the calm source.
      float deformation = smoothstep(0.12, 0.80, distanceOnSphere);
      return vec2(distanceOnSphere + folds * deformation, distanceOnSphere);
    }
    vec3 surfaceRings(vec3 eye, vec3 ray, float b) {
      float disc = b*b - dot(eye, eye) + 1.0;
      if (disc <= 0.0) return vec3(0.0);
      vec3 surface = normalize(eye + ray * (-b - sqrt(disc)));
      // Each center follows its own broad, breathing path. Staggered angles
      // keep all three separated while their radii and tempos vary independently.
      vec3 angles = time * 0.16 + vec3(2.25, 0.15, 4.35)
                  + vec3(0.28, 0.35, 0.30)
                    * sin(time * vec3(0.11, 0.13, 0.10) + vec3(0.0, 1.4, 3.0));
      vec3 radii = vec3(0.62, 0.68, 0.57) + vec3(0.15, 0.13, 0.15)
                 * sin(time * vec3(0.14, 0.12, 0.16) + vec3(0.4, 2.2, 4.1));
      vec3 sourceA = vec3(cos(angles.x) * radii.x, sin(angles.x) * radii.x, 0.78);
      vec3 sourceB = vec3(cos(angles.y) * radii.y, sin(angles.y) * radii.y, 0.78);
      vec3 sourceC = vec3(cos(angles.z) * radii.z, sin(angles.z) * radii.z, 0.78);
      vec2 fieldA = ringDistance(surface, normalize(sourceA), vec2(0.0));
      vec2 fieldB = ringDistance(surface, normalize(sourceB), vec2(7.3, -3.8));
      vec2 fieldC = ringDistance(surface, normalize(sourceC), vec2(-4.1, 9.7));
      // The selected star uses the same view-space sphere as the Canvas nodes.
      // Orient its source with the camera tilt so the wave begins at the star.
      vec2 fieldD = vec2(100.0);
      if (focusSource.w > 0.0) fieldD = ringDistance(surface, orient(focusSource.xyz), vec2(11.2, 5.6));
      vec4 fields = vec4(fieldA.x, fieldB.x, fieldC.x, fieldD.x);
      const float junctionWidth = 0.12;
      #ifdef GL_FRAGMENT_PRECISION_HIGH
        const float birthFloor = 0.00001;
      #else
        const float birthFloor = 0.0001;
      #endif
      // Strong, medium and weak sources breathe gently without changing rank.
      vec4 sourceStrength = vec4(1.20, 0.75, 0.37, 1.58) + vec4(0.09, 0.07, 0.045, 0.05)
                          * sin(time * vec4(0.21, 0.17, 0.24, 0.19) + vec4(0.0, 1.6, 3.2, 2.1));
      float lines = 0.0;
      for (int pulse = 0; pulse < 9; pulse++) {
        vec4 age = pulseAges[pulse];
        vec4 born = smoothstep(vec4(0.0), vec4(0.28), age);
        born.w *= focusSource.w;
        // Each pulse travels at a constant speed after its own random birth.
        // The logarithmic birth weight joins a new source smoothly into the
        // same soft union, without letting an unborn front bend a visible line.
        vec4 fronts = fields - age * 0.304
                    - junctionWidth * log(max(born, vec4(birthFloor)));
        if (born.w <= birthFloor) fronts.w = 100.0;
        float nearest = min(min(fronts.x, fronts.y), min(fronts.z, fronts.w));
        vec4 influence = exp(-(fronts - nearest) / junctionWidth);
        float influenceSum = influence.x + influence.y + influence.z + influence.w;
        float mergedFront = nearest - junctionWidth * log(influenceSum);
        float phase = mergedFront * 12.5;
        float crestWidth = 0.17;
        #ifdef ATLAS_DERIVATIVES
          crestWidth = max(crestWidth, min(0.36, fwidth(phase) * 0.60));
        #endif
        float crest = exp(-phase * phase / (crestWidth * crestWidth)) * (0.17 / crestWidth);
        float shoulder = exp(-phase * phase / 0.152);
        float strength = dot(influence / influenceSum, sourceStrength * born);
        // Independent generations keep travelling; crossing fronts share the
        // brighter crest rather than accumulating a white glare.
        lines = max(lines, (crest * 0.72 + shoulder * 0.075) * strength);
      }
      float distanceOnSphere = min(fieldA.y, min(fieldB.y, fieldC.y));
      float envelope = smoothstep(0.025, 0.14, distanceOnSphere)
                     * (1.0 - smoothstep(2.20, 2.90, distanceOnSphere));
      float focusEnvelope = smoothstep(0.025, 0.14, fieldD.y)
                          * (1.0 - smoothstep(2.20, 2.90, fieldD.y));
      envelope = mix(envelope, max(envelope, focusEnvelope), focusSource.w);
      float facing = pow(max(0.0, dot(surface, -ray)), 0.35);
      float coverage = smoothstep(0.0, 0.035, disc);
      float palette = clamp(0.50 + surface.x * 0.35 - surface.y * 0.27, 0.0, 1.0);
      vec3 tint = mix(mix(ice, violet, palette), vec3(0.88, 0.95, 1.0), 0.24);
      return tint * lines * envelope * facing * coverage;
    }
    void main() {
      vec2 p = uv * 1.65;
      float r = length(p);
      mistTime = time * 4.0;
      vec3 eye = orient(vec3(0.0, 0.0, 3.7));
      vec3 ray = orient(normalize(vec3(p, -3.7)));
      float b = dot(eye, ray);
      float disc = b*b - dot(eye, eye) + 1.11 * 1.11;
      vec3 radiance = vec3(0.0);
      if (disc > 0.0) {
        float chord = sqrt(disc);
        float stepLength = chord * 2.0 / sampleCount;
        // Fixed spatial jitter reduces sampling bands without temporal flicker.
        float jitter = 0.35 + hash(vec3(floor(gl_FragCoord.xy), 1.0)) * 0.30;
        float travel = -b - chord + stepLength * jitter;
        float transmission = 1.0;
        vec3 light = orient(normalize(vec3(-0.75, 0.85, 0.65)));
        for (int i = 0; i < 36; i++) {
          if (float(i) >= sampleCount || transmission < 0.025) break;
          vec3 point = eye + ray * travel;
          float density = densityAt(point);
          if (density > 0.005) {
            // A density difference approximates directional scattering/shadow.
            float ahead = densityAt(point + light * 0.16);
            float shading = clamp(0.56 + (density - ahead) * 1.45, 0.18, 1.15);
            float opacity = 1.0 - exp(-density * stepLength * 1.75);
            float palette = clamp(0.50 + point.x * 0.40 - point.y * 0.30
                             - point.z * 0.18, 0.0, 1.0);
            vec3 tint = mix(ice, violet, palette);
            // Front-to-back absorption hides distant layers behind dense swells.
            vec3 scattering = tint * (0.30 + shading * 0.90) + deep * 0.025;
            scattering *= 0.78 + rippleAt(point) * 0.22;
            radiance += transmission * opacity * scattering;
            transmission *= 1.0 - opacity;
          }
          travel += stepLength;
        }
      }
      radiance += surfaceRings(eye, ray, b);
      float sphereEdge = 3.7 / sqrt(3.7 * 3.7 - 1.0);
      float rim = exp(-abs(r - sphereEdge) * 36.0);
      float halo = exp(-abs(r - sphereEdge) * 9.0);
      vec3 edgeTint = mix(ice, violet, clamp(0.5 + p.x * 0.28 - p.y * 0.24, 0.0, 1.0));
      radiance += edgeTint * (rim * 0.018 + halo * 0.032);
      radiance *= 0.94 + 0.06 * sin(mistTime * 0.48);
      radiance *= 1.0 - smoothstep(1.22, 1.62, r);
      // Reversible HDR encoding works in RGBA8 without float texture extensions.
      float peak = max(radiance.r, max(radiance.g, radiance.b));
      gl_FragColor = vec4(quantizeSmoothly(radiance / (1.0 + peak), quantizationStep), 1.0);
    }
  `;

  const blurFragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      precision highp sampler2D;
    #else
      precision mediump float;
      precision mediump sampler2D;
    #endif
    varying vec2 uv;
    uniform sampler2D source;
    uniform vec2 stepSize;
    uniform float extract;
    uniform float quantizationStep;
    ${dither}
    vec3 sampleLight(vec2 at) {
      vec3 encoded = texture2D(source, at).rgb;
      float peak = max(encoded.r, max(encoded.g, encoded.b));
      vec3 light = encoded / max(1.0 - peak, 0.01);
      float brightness = max(light.r, max(light.g, light.b));
      float knee = clamp((brightness - 0.18) / 0.24, 0.0, 1.0);
      float contribution = max(brightness - 0.30, 0.0) + knee * knee * 0.06;
      return mix(light, light * contribution / max(brightness, 0.001), extract);
    }
    void main() {
      vec2 at = uv * 0.5 + 0.5;
      vec3 light = sampleLight(at) * 0.227027;
      light += (sampleLight(at + stepSize) + sampleLight(at - stepSize)) * 0.1945946;
      light += (sampleLight(at + stepSize * 2.0) + sampleLight(at - stepSize * 2.0)) * 0.1216216;
      light += (sampleLight(at + stepSize * 3.0) + sampleLight(at - stepSize * 3.0)) * 0.054054;
      light += (sampleLight(at + stepSize * 4.0) + sampleLight(at - stepSize * 4.0)) * 0.016216;
      float peak = max(light.r, max(light.g, light.b));
      gl_FragColor = vec4(quantizeSmoothly(light / (1.0 + peak), quantizationStep), 1.0);
    }
  `;

  const compositeFragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      precision highp sampler2D;
    #else
      precision mediump float;
      precision mediump sampler2D;
    #endif
    varying vec2 uv;
    uniform sampler2D scene;
    uniform sampler2D bloom;
    ${dither}
    vec3 decodeLight(vec3 encoded) {
      return encoded / max(1.0 - max(encoded.r, max(encoded.g, encoded.b)), 0.01);
    }
    void main() {
      vec2 at = uv * 0.5 + 0.5;
      vec3 light = decodeLight(texture2D(scene, at).rgb)
                 + decodeLight(texture2D(bloom, at).rgb) * 0.85;
      light *= 1.75;
      float peak = max(light.r, max(light.g, light.b));
      vec3 color = pow(light / (1.0 + peak), vec3(1.08));
      // Add one output quantization step even in dark gradients; relative grain vanishes there.
      color = quantizeSmoothly(color, 1.0 / 255.0);
      float alpha = max(color.r, max(color.g, color.b));
      gl_FragColor = vec4(color, alpha);
    }
  `;

  class AtlasAura {
    constructor(host) {
      this.host = host;
      this.canvas = host.querySelector('canvas');
      this.clock = 0;
      this.emissionSeed = Math.random() * 1000;
      this.pulseAges = new Float32Array(36);
      this.focusId = -1;
      this.focusStart = null;
      this.focusGeneration = 0;
      this.focusGain = 0;
      this.focusSource = new Float32Array([0, 0, 1, 0]);
      this.lastFrame = -Infinity;
      this.dirty = true;
      this.ready = false;
      this.quality = 1;
      this.slowFrames = 0;
      this.fastFrames = 0;
      this.tiltX = 0;
      this.tiltY = 0;
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        this.ready = false;
        host.classList.remove('aura-ready');
      });
      this.canvas.addEventListener('webglcontextrestored', () => this.init());
      this.init();
    }

    init() {
      const gl = this.canvas.getContext('webgl', {
        alpha: true, premultipliedAlpha: true, antialias: false,
        depth: false, stencil: false, powerPreference: 'low-power'
      });
      if (!gl) return;
      this.gl = gl;
      const halfFloat = gl.getExtension('OES_texture_half_float');
      const halfLinear = gl.getExtension('OES_texture_half_float_linear');
      const halfRenderable = gl.getExtension('EXT_color_buffer_half_float');
      this.targetType = halfFloat && halfLinear && halfRenderable ? halfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
      const shaders = [];
      let buffer;
      const programs = [];
      const targets = [];
      try {
        const compile = (type, source) => {
          const shader = gl.createShader(type);
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
          return shader;
        };
        const sharedVertex = compile(gl.VERTEX_SHADER, vertex);
        const makeProgram = source => {
          const program = gl.createProgram();
          programs.push(program);
          gl.attachShader(program, sharedVertex);
          gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
          gl.bindAttribLocation(program, 0, 'position');
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
          return program;
        };
        const sceneShader = gl.getExtension('OES_standard_derivatives')
          ? '#extension GL_OES_standard_derivatives : enable\n#define ATLAS_DERIVATIVES 1\n' + fragment
          : fragment;
        this.sceneProgram = makeProgram(sceneShader);
        this.blurProgram = makeProgram(blurFragment);
        this.compositeProgram = makeProgram(compositeFragment);
        gl.useProgram(this.sceneProgram);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const uniforms = (program, keys) => Object.fromEntries(keys.map(key => [key, gl.getUniformLocation(program, key)]));
        this.uniforms = uniforms(this.sceneProgram, ['time', 'rotation', 'ice', 'violet', 'deep', 'sampleCount', 'focusSource', 'quantizationStep']);
        this.uniforms.pulseAges = gl.getUniformLocation(this.sceneProgram, 'pulseAges[0]');
        this.blurUniforms = uniforms(this.blurProgram, ['source', 'stepSize', 'extract', 'quantizationStep']);
        this.compositeUniforms = uniforms(this.compositeProgram, ['scene', 'bloom']);
        const css = getComputedStyle(this.host);
        for (const key of ['ice', 'violet', 'deep']) {
          const hex = css.getPropertyValue('--aura-' + key).trim();
          gl.uniform3fv(this.uniforms[key], [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255));
        }
        for (let i = 0; i < 3; i++) {
          const target = { texture: gl.createTexture(), framebuffer: gl.createFramebuffer() };
          targets.push(target);
          gl.bindTexture(gl.TEXTURE_2D, target.texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
        }
        this.targets = targets;
        this.targetResolution = 0;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.DEPTH_TEST);
        this.ready = true;
        this.dirty = true;
        this.host.classList.add('aura-ready');
      } catch (error) {
        programs.forEach(program => gl.deleteProgram(program));
        targets.forEach(target => {
          gl.deleteTexture(target.texture);
          gl.deleteFramebuffer(target.framebuffer);
        });
        if (buffer) gl.deleteBuffer(buffer);
        console.warn('Aura uses its CSS fallback:', error.message);
      } finally {
        shaders.forEach(shader => gl.deleteShader(shader));
      }
    }

    resizeTargets(resolution) {
      const gl = this.gl;
      const bloomResolution = Math.max(1, Math.round(resolution / 2));
      for (let i = 0; i < this.targets.length; i++) {
        const target = this.targets[i];
        target.size = i === 0 ? resolution : bloomResolution;
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, target.size, target.size, 0, gl.RGBA, this.targetType, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          if (this.targetType !== gl.UNSIGNED_BYTE) {
            // Some devices advertise float support but cannot render this attachment.
            this.targetType = gl.UNSIGNED_BYTE;
            return this.resizeTargets(resolution);
          }
          this.ready = false;
          this.host.classList.remove('aura-ready');
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          console.warn('Aura uses its CSS fallback: offscreen rendering unavailable');
          return false;
        }
      }
      this.targetResolution = resolution;
      this.host.dataset.lightPrecision = this.targetType === gl.UNSIGNED_BYTE ? '8-bit-dithered' : '16-bit-float';
      return true;
    }

    updatePulseAges() {
      // Stable birth times: redraws, pause and buffer rotation never reroll a
      // travelling pulse. A reload seeds a fresh sequence for all three sources.
      const period = 1.50, timingScale = period / 1.65, offsets = [0.35, 0.90, 1.45];
      const newest = Math.floor(this.clock / period);
      for (let pulse = 0; pulse < 9; pulse++) {
        const generation = newest - pulse;
        for (let source = 0; source < 3; source++) {
          const random = Math.sin(generation * 12.9898 + (source + 1) * 78.233
                       + this.emissionSeed * 0.713) * 43758.5453;
          const jitter = (random - Math.floor(random) - 0.5) * 0.70;
          const birth = generation * period + (offsets[source] + jitter) * timingScale;
          this.pulseAges[pulse * 4 + source] = this.clock - birth;
        }
        // Selection starts a fresh sequence; no rings from before the click.
        const step = generation - this.focusGeneration;
        if (this.focusStart !== null && step >= 0) {
          const random = Math.sin(generation * 17.123 + this.emissionSeed * 0.331) * 43758.5453;
          const jitter = step === 0 ? 0 : (random - Math.floor(random) - 0.5) * 0.32;
          const birth = step === 0 ? this.focusStart : Math.max(generation * period + 0.05, this.focusStart + step * period + jitter);
          this.pulseAges[pulse * 4 + 3] = this.clock - birth;
        } else this.pulseAges[pulse * 4 + 3] = -100;
      }
    }

    render({ x, y, radius, dt, now, running, mobile, tiltX = 0, tiltY = 0, focusId = -1, focusReady = false, focusSource = [0, 0, 1] }) {
      if (running) this.clock += dt / 1000;
      if (focusId >= 0 && focusId !== this.focusId) {
        this.focusStart = null;
        this.focusGain = 0;
        this.dirty = true;
      }
      this.focusId = focusId;
      if (focusId >= 0) {
        for (let i = 0; i < 3; i++) {
          if (this.focusSource[i] !== Math.fround(focusSource[i])) this.dirty = true;
          this.focusSource[i] = focusSource[i];
        }
        if (focusReady && this.focusStart === null) {
          this.focusStart = this.clock - 0.25;
          this.focusGeneration = Math.floor(this.clock / 1.50);
          this.dirty = true;
        }
      }
      const focusTarget = focusId >= 0 && this.focusStart !== null ? 1 : 0;
      const previousGain = this.focusGain;
      this.focusGain = running ? this.focusGain + (focusTarget - this.focusGain) * (1 - Math.exp(-dt / 200)) : focusTarget;
      if (Math.abs(this.focusGain - focusTarget) < 0.001) this.focusGain = focusTarget;
      if (focusTarget === 0 && this.focusGain === 0) this.focusStart = null;
      if (this.focusGain !== previousGain) this.dirty = true;
      this.focusSource[3] = this.focusGain;
      const ease = 1.0 - Math.exp(-dt / 180);
      if (running) {
        this.tiltX += (tiltX - this.tiltX) * ease;
        this.tiltY += (tiltY - this.tiltY) * ease;
      }
      if (Math.abs(this.tiltX) < 0.0001) this.tiltX = 0;
      if (Math.abs(this.tiltY) < 0.0001) this.tiltY = 0;
      // Share the star projection, including the card-open layout and zoom.
      const size = radius * 3.3;
      const layout = `${x}:${y}:${size}`;
      if (layout !== this.layout) {
        this.host.style.width = size + 'px';
        this.host.style.height = size + 'px';
        this.host.style.transform = `translate(${x-size/2}px,${y-size/2}px)`;
        this.layout = layout;
        this.dirty = true;
      }
      this.host.classList.toggle('aura-paused', !running);
      if (!this.ready) return;
      if (this.mobile !== mobile) { this.mobile = mobile; this.dirty = true; }
      // Pointer tilt changes the view; wave motion stays independent of the stars.
      const viewX = this.tiltX, viewY = this.tiltY;
      const moved = viewX !== this.angleX || viewY !== this.angleY;
      if (!this.dirty && !moved && !running) return;
      if (!this.dirty && now - this.lastFrame < 1000 / 60 - 1) return;
      // Adapt pixel cost to the actual frame interval, with recovery hysteresis.
      if (dt > 24 && running) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 35 && this.quality > 0.65) {
        this.quality = Math.max(0.65, this.quality - 0.15);
        this.slowFrames = 0;
      }
      if (dt < 19 && running) this.fastFrames++; else this.fastFrames = 0;
      if (this.fastFrames > 300 && this.quality < 1) {
        this.quality = Math.min(1, this.quality + 0.10);
        this.fastFrames = 0;
      }
      const resolution = Math.round(Math.min(size, mobile ? 280 : 440) * this.quality);
      // Keep ray marching cheap, but composite/dither at display resolution so CSS scaling does not blur the noise away.
      const outputResolution = Math.max(1, Math.round(Math.min(size * Math.min(window.devicePixelRatio || 1, 2), mobile ? 1024 : 1536)));
      const gl = this.gl;
      if (this.canvas.width !== outputResolution) {
        this.canvas.width = outputResolution;
        this.canvas.height = outputResolution;
      }
      if (this.targetResolution !== resolution && !this.resizeTargets(resolution)) return;
      const [scene, horizontal, bloom] = this.targets;
      gl.useProgram(this.sceneProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
      gl.viewport(0, 0, resolution, resolution);
      gl.uniform1f(this.uniforms.time, this.clock);
      this.updatePulseAges();
      gl.uniform4fv(this.uniforms.pulseAges, this.pulseAges);
      gl.uniform4fv(this.uniforms.focusSource, this.focusSource);
      gl.uniform2f(this.uniforms.rotation, viewX, viewY);
      gl.uniform1f(this.uniforms.sampleCount, mobile ? 24 : 36);
      const quantizationStep = this.targetType === gl.UNSIGNED_BYTE ? 1 / 255 : 0;
      gl.uniform1f(this.uniforms.quantizationStep, quantizationStep);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.useProgram(this.blurProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(this.blurUniforms.source, 0);
      gl.uniform1f(this.blurUniforms.quantizationStep, quantizationStep);
      gl.viewport(0, 0, bloom.size, bloom.size);
      gl.bindFramebuffer(gl.FRAMEBUFFER, horizontal.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform2f(this.blurUniforms.stepSize, 2.2 / bloom.size, 0);
      gl.uniform1f(this.blurUniforms.extract, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, horizontal.texture);
      gl.uniform2f(this.blurUniforms.stepSize, 0, 2.2 / bloom.size);
      gl.uniform1f(this.blurUniforms.extract, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.useProgram(this.compositeProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outputResolution, outputResolution);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform1i(this.compositeUniforms.scene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
      gl.uniform1i(this.compositeUniforms.bloom, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);
      this.angleX = viewX;
      this.angleY = viewY;
      this.lastFrame = now;
      this.dirty = false;
    }
  }
  window.AtlasAura = AtlasAura;
})();
