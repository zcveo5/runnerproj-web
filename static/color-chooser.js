class ColorPicker extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {

        const initialValue = this.getAttribute('value') || '#FF6347';

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              width: fit-content;
              box-sizing: border-box;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* Наследуем box-sizing для корректного расчета размеров */
            *, *::before, *::after {
              box-sizing: border-box;
            }

            .picker {
              background: #1a1a1e;
              border: 1px solid #2e2e34;
              border-radius: 16px;
              padding: 20px;
              width: 280px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
              display: flex;
              flex-direction: column;
              gap: 16px;
            }

            .preview {
              width: 100%;
              height: 60px;
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              transition: background-color 0.1s ease;
            }

            .group {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 500;
              color: #a1a1aa;
            }

            input[type="range"] {
              -webkit-appearance: none;
              appearance: none;
              width: 100%;
              height: 8px;
              border-radius: 4px;
              outline: none;
              background: #2a2a30;
              cursor: pointer;
            }

            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: #ffffff;
              border: 2px solid #1a1a1e;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
              cursor: pointer;
              transition: transform 0.1s ease;
            }

            input[type="range"]::-webkit-slider-thumb:hover {
              transform: scale(1.15);
            }

            #red { background: linear-gradient(to right, #000, #ff0000); }
            #green { background: linear-gradient(to right, #000, #00ff00); }
            #blue { background: linear-gradient(to right, #000, #0000ff); }

            .hex-wrapper input {
              width: 100%;
              background: #242429;
              border: 1px solid #36363d;
              border-radius: 8px;
              padding: 10px 12px;
              color: #ffffff;
              font-family: monospace;
              font-size: 15px;
              letter-spacing: 1px;
              outline: none;
              transition: border-color 0.2s ease;
            }

            .hex-wrapper input:focus {
              border-color: #6366f1;
            }
          </style>

          <div class="picker">
            <div class="preview" id="preview"></div>

            <div class="group">
              <div class="header"><span>Red</span><span id="r-val">0</span></div>
              <input type="range" id="red" min="0" max="255">
            </div>

            <div class="group">
              <div class="header"><span>Green</span><span id="g-val">0</span></div>
              <input type="range" id="green" min="0" max="255">
            </div>

            <div class="group">
              <div class="header"><span>Blue</span><span id="b-val">0</span></div>
              <input type="range" id="blue" min="0" max="255">
            </div>

            <div class="group">
              <div class="header"><span>HEX</span></div>
              <div class="hex-wrapper">
                <input type="text" id="hex" maxlength="7">
              </div>
            </div>
          </div>
        `;

        this.initElements();
        this.setValue(initialValue);
        this.addEventListeners();
    }

    initElements() {
        this.red = this.shadowRoot.getElementById('red');
        this.green = this.shadowRoot.getElementById('green');
        this.blue = this.shadowRoot.getElementById('blue');
        this.rVal = this.shadowRoot.getElementById('r-val');
        this.gVal = this.shadowRoot.getElementById('g-val');
        this.bVal = this.shadowRoot.getElementById('b-val');
        this.hex = this.shadowRoot.getElementById('hex');
        this.preview = this.shadowRoot.getElementById('preview');
    }

    get value() {
        return this.hex.value;
    }

    set value(val) {
        this.setValue(val);
    }

    setValue(hexStr) {
        const rgb = this.hexToRgb(hexStr);
        if (rgb) {
            this.red.value = rgb.r;
            this.green.value = rgb.g;
            this.blue.value = rgb.b;
            this.updateUI(rgb.r, rgb.g, rgb.b, this.rgbToHex(rgb.r, rgb.g, rgb.b));
        }
    }

    updateUI(r, g, b, hexStr) {
        this.rVal.textContent = r;
        this.gVal.textContent = g;
        this.bVal.textContent = b;
        this.hex.value = hexStr.toUpperCase();
        this.preview.style.backgroundColor = hexStr;
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this.value },
            bubbles: true,
            composed: true
        }));
    }

    addEventListeners() {
        const updateFromSliders = () => {
            const r = parseInt(this.red.value);
            const g = parseInt(this.green.value);
            const b = parseInt(this.blue.value);
            const hexStr = this.rgbToHex(r, g, b);

            this.updateUI(r, g, b, hexStr);
            this.notifyChange();
        };

        [this.red, this.green, this.blue].forEach(slider => {
            slider.addEventListener('input', updateFromSliders);
        });

        this.hex.addEventListener('input', () => {
            let val = this.hex.value.trim();
            if (!val.startsWith('#')) val = '#' + val;

            const rgb = this.hexToRgb(val);
            if (rgb) {
                this.red.value = rgb.r;
                this.green.value = rgb.g;
                this.blue.value = rgb.b;
                this.rVal.textContent = rgb.r;
                this.gVal.textContent = rgb.g;
                this.bVal.textContent = rgb.b;
                this.preview.style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                this.notifyChange();
            }
        });
    }

    rgbToHex(r, g, b) {
        const toHex = c => Number(c).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    hexToRgb(hex) {
        let clean = hex.replace('#', '');
        if (clean.length === 3) clean = clean.split('').map(x => x + x).join('');
        if (clean.length !== 6) return null;
        const num = parseInt(clean, 16);
        if (isNaN(num)) return null;
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
}

window.customElements.define('color-picker', ColorPicker);

console.log('Loaded color-picker')