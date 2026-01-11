import "#elements/EmptyState";

import Styles from "./ak-flow-card.css";

import { AKElement } from "#elements/Base";
import { SlottedTemplateResult } from "#elements/types";

import { ChallengeTypes } from "@goauthentik/api";

import { msg } from "@lit/localize";
import { CSSResult, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import PFLogin from "@patternfly/patternfly/components/Login/login.css";
import PFTitle from "@patternfly/patternfly/components/Title/title.css";
import PFBase from "@patternfly/patternfly/patternfly-base.css";

/**
 * Translates common flow titles to the current locale.
 * Falls back to the original title if no translation is found.
 */
function translateFlowTitle(title: string): string {
    const translations: Record<string, () => string> = {
        "Sign In": () => msg("Sign In", { id: "flow-title-sign-in" }),
        "Reset Password": () => msg("Reset Password", { id: "flow-title-reset-password" }),
        "Change Password": () => msg("Change Password", { id: "flow-title-change-password" }),
        "Register": () => msg("Register", { id: "flow-title-register" }),
        "Update Profile": () => msg("Update Profile", { id: "flow-title-update-profile" }),
        "Complete Your Account": () =>
            msg("Complete Your Account", { id: "flow-title-complete-account" }),
    };
    return translations[title]?.() ?? title;
}

/**
 * @element ak-flow-card
 * @class FlowCard
 * @slot title - Title of the card, optional, when not set uses the flow title
 * @slot - Main body of the card
 * @slot footer - Footer links, optional
 * @slot footer-band - Band in the footer, option
 *
 */
@customElement("ak-flow-card")
export class FlowCard extends AKElement {
    role = "presentation";

    @property({ type: Object })
    challenge?: ChallengeTypes;

    @property({ type: Boolean })
    loading = false;

    static styles: CSSResult[] = [PFBase, PFLogin, PFTitle, Styles];

    render() {
        let inner = html`<slot></slot>`;
        if (!this.challenge || this.loading) {
            inner = html`<ak-empty-state loading default-label></ak-empty-state>`;
        }
        // No title if the challenge doesn't provide a title and no custom title is set
        let title: null | SlottedTemplateResult = null;
        if (this.hasSlotted("title")) {
            title = html`<h1 class="pf-c-title pf-m-3xl"><slot name="title"></slot></h1>`;
        } else if (this.challenge?.flowInfo?.title) {
            const translatedTitle = translateFlowTitle(this.challenge.flowInfo.title);
            title = html`<h1 class="pf-c-title pf-m-3xl">${translatedTitle}</h1>`;
        }
        const footer = this.hasSlotted("footer") ? html`<slot name="footer"></slot>` : null;
        const footerBand = this.hasSlotted("footer-band")
            ? html`<slot name="footer-band"></slot>`
            : null;

        return html`${title ? html`<div class="pf-c-login__main-header">${title}</div>` : null}
            <div class="pf-c-login__main-body">${inner}</div>
            ${footer || footerBand
                ? html`<div class="pf-c-login__main-footer">${footer}${footerBand}</div>`
                : null}`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ak-flow-card": FlowCard;
    }
}
