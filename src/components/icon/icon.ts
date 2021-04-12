import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import { unsafeSVG } from 'lit-html/directives/unsafe-svg';
import { event, EventEmitter, watch } from '../../internal/decorators';
import styles from 'sass:./icon.scss';
import { getIconLibrary, watchIcon, unwatchIcon } from './library';
import { requestIcon } from './request';

const parser = new DOMParser();

/**
 * @since 2.0
 * @status stable
 *
 * @part base - The component's base wrapper.
 */
@customElement('sl-icon')
export default class SlIcon extends LitElement {
  static styles = unsafeCSS(styles);

  @state() private svg = '';

  /** The name of the icon to draw. */
  @property() name: string;

  /** An external URL of an SVG file. */
  @property() src: string;

  /** An alternative description to use for accessibility. If omitted, the name or src will be used to generate it. */
  @property() label: string;

  /** The name of a registered custom icon library. */
  @property() library = 'default';

  /** Emitted when the icon has loaded. */
  @event('sl-load') slLoad: EventEmitter<void>;

  /** Emitted when the icon failed to load.  */
  @event('sl-error') slError: EventEmitter<{ status: number }>;

  connectedCallback() {
    super.connectedCallback();
    watchIcon(this);
  }

  firstUpdated() {
    this.setIcon();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchIcon(this);
  }

  getLabel() {
    let label = '';

    if (this.label) {
      label = this.label;
    } else if (this.name) {
      label = this.name.replace(/-/g, ' ');
    } else if (this.src) {
      label = this.src.replace(/.*\//, '').replace(/-/g, ' ').replace(/\.svg/i, '');
    }

    return label;
  }

  private getUrl(): string {
    const library = getIconLibrary(this.library);
    if (this.name && library) {
      return library.resolver(this.name);
    } else {
      return this.src;
    }
  }

  /** @internal Fetches the icon and redraws it. Used to handle library registrations. */
  redraw() {
    this.setIcon();
  }

  @watch('name')
  @watch('src')
  @watch('library')
  async setIcon() {
    const library = getIconLibrary(this.library);
    const url = this.getUrl();
    if (url) {
      try {
        const file = await requestIcon(url)!;
        if (url !== this.getUrl()) {
          // If the url has changed while fetching the icon, ignore this request.
          return;
        } else if (file.ok) {
          const doc = parser.parseFromString(file.svg, 'text/html');
          const svgEl = doc.body.querySelector('svg');

          if (svgEl) {
            if (library && library.mutator) {
              library.mutator(svgEl);
            }

            this.svg = svgEl.outerHTML;
            this.slLoad.emit();
          } else {
            this.svg = '';
            this.slError.emit({ detail: { status: file.status } });
          }
        } else {
          this.svg = '';
          this.slError.emit({ detail: { status: file.status } });
        }
      } catch {
        this.slError.emit({ detail: { status: -1 } });
      }
    } else if (this.svg) {
      // If we can't resolve a URL and an icon was previously set, remove it
      this.svg = '';
    }
  }

  handleChange() {
    this.setIcon();
  }

  render() {
    return html` <div part="base" class="icon" role="img" aria-label=${this.getLabel()}>${unsafeSVG(this.svg)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sl-icon': SlIcon;
  }
}
