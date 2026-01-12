import { TargetLanguageTag } from "#common/ui/locale/definitions";
import { setSessionLocale } from "#common/ui/locale/utils";

import { AKElement } from "#elements/Base";
import Styles from "#elements/locale/ak-locale-links.css";
import { WithLocale } from "#elements/mixins/locale";

import { LOCALE_STATUS_EVENT, LocaleStatusEventDetail } from "@lit/localize";
import { html, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

/**
 * payware-specific locale selector with text links
 * Displays: English | Български | Español
 * Positioned at bottom-left to match portal design
 */
@customElement("ak-locale-links")
export class AKLocaleLinks extends WithLocale(AKElement) {
    public static readonly styles = [Styles];

    // Languages supported by payware (EN, BG, ES)
    private readonly supportedLocales: Array<{ tag: TargetLanguageTag; label: string }> = [
        { tag: "en", label: "English" },
        { tag: "bg-BG", label: "Български" },
        { tag: "es-ES", label: "Español" },
    ];

    @state()
    protected ready = false;

    #readyTimeout = -1;

    #localeStatusListener = (event: CustomEvent<LocaleStatusEventDetail>) => {
        if (event.detail.status !== "ready") {
            return;
        }

        if (!this.ready) {
            this.ready = true;
            window.clearTimeout(this.#readyTimeout);
        }
    };

    public override connectedCallback(): void {
        super.connectedCallback();

        window.addEventListener(LOCALE_STATUS_EVENT, this.#localeStatusListener, {
            once: true,
            passive: true,
        });
    }

    public override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearTimeout(this.#readyTimeout);
        window.removeEventListener(LOCALE_STATUS_EVENT, this.#localeStatusListener);
    }

    public override firstUpdated(changed: PropertyValues<this>): void {
        super.firstUpdated(changed);

        // Fallback to ready if the network is taking too long.
        this.#readyTimeout = window.setTimeout(() => {
            this.ready = true;
            window.removeEventListener(LOCALE_STATUS_EVENT, this.#localeStatusListener);
        }, 250);
    }

    private handleLocaleChange(tag: TargetLanguageTag) {
        requestAnimationFrame(() => {
            this.activeLanguageTag = tag;  // Triggers actual locale change
            setSessionLocale(tag);          // Persists to session storage
        });
    }

    protected override render() {
        if (!this.ready) {
            return null;
        }

        const activeLocaleTag = this.activeLanguageTag;

        return html`
            <div class="locale-links">
                <svg
                    class="icon"
                    role="img"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 32 32"
                >
                    <path
                        d="M27.85 29H30l-6-15h-2.35l-6 15h2.15l1.6-4h6.85Zm-7.65-6 2.62-6.56L25.45 23ZM18 7V5h-7V2H9v3H2v2h10.74a14.7 14.7 0 0 1-3.19 6.18A13.5 13.5 0 0 1 7.26 9h-2.1a16.5 16.5 0 0 0 3 5.58A16.8 16.8 0 0 1 3 18l.75 1.86A18.5 18.5 0 0 0 9.53 16a16.9 16.9 0 0 0 5.76 3.84L16 18a14.5 14.5 0 0 1-5.12-3.37A17.64 17.64 0 0 0 14.8 7Z"
                    />
                </svg>
                ${this.supportedLocales.map((locale, index) => {
                    // Check if this locale matches the active one
                    // For "en", match both "en" exactly
                    // For others like "bg-BG", match the full tag
                    const isActive = activeLocaleTag === locale.tag;
                    return html`
                        ${index > 0 ? html`<span class="separator">|</span>` : ""}
                        <a
                            href="javascript:void(0)"
                            class=${classMap({ active: isActive })}
                            @click=${() => this.handleLocaleChange(locale.tag)}
                        >
                            ${locale.label}
                        </a>
                    `;
                })}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ak-locale-links": AKLocaleLinks;
    }
}
