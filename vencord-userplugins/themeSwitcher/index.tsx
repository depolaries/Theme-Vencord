/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sunl3ss
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    findOption,
    sendBotMessage
} from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Popout, showToast, Toasts, useRef, useState } from "@webpack/common";
import type { CSSProperties, PropsWithChildren } from "react";

const Native = VencordNative.pluginHelpers.ThemeSwitcher as PluginNative<typeof import("./native")>;
const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

const presetDefinitions = [
    { value: "black", label: "Black", color: "#a7a9ad" },
    { value: "gothic", label: "Gothic", color: "#747984" },
    { value: "green", label: "Green", color: "#23a55a" },
    { value: "purple", label: "Purple", color: "#9b59d0" },
    { value: "red", label: "Red", color: "#ff2e35" }
] as const;

type Preset = typeof presetDefinitions[number]["value"];

function isPreset(value: string): value is Preset {
    return presetDefinitions.some(preset => preset.value === value.toLowerCase());
}

function displayName(preset: Preset) {
    return presetDefinitions.find(item => item.value === preset)!.label;
}

async function applyPreset(preset: Preset, notify = true) {
    try {
        await Native.applyPreset(preset);
        if (notify) showToast(`Theme: ${displayName(preset)}`, Toasts.Type.SUCCESS);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(`Theme switch failed: ${message}`, Toasts.Type.FAILURE);
        throw error;
    }
}

const settings = definePluginSettings({
    preset: {
        type: OptionType.SELECT,
        description: "Active MyTheme preset",
        options: presetDefinitions.map(preset => ({
            label: preset.label,
            value: preset.value,
            default: preset.value === "green"
        })),
        onChange: value => void applyPreset(value as Preset)
    }
});

function selectPreset(preset: Preset) {
    if (settings.store.preset !== preset) settings.store.preset = preset;
}

function ThemeIcon({ preset }: { preset: Preset; }) {
    const activeColor = presetDefinitions.find(item => item.value === preset)!.color;

    return (
        <span className="vc-theme-switcher-icon" style={{ "--vc-theme-color": activeColor } as CSSProperties}>
            <span />
        </span>
    );
}

function ThemePicker({ onClose }: { onClose(): void; }) {
    const { preset } = settings.use(["preset"]);

    return (
        <div className="vc-theme-switcher-popout">
            <div className="vc-theme-switcher-heading">Theme color</div>
            <div className="vc-theme-switcher-options">
                {presetDefinitions.map(item => {
                    const selected = item.value === preset;

                    return (
                        <button
                            key={item.value}
                            type="button"
                            className="vc-theme-switcher-option"
                            data-selected={selected}
                            onClick={() => {
                                selectPreset(item.value);
                                onClose();
                            }}
                        >
                            <span className="vc-theme-switcher-swatch" style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                            {selected && <span aria-hidden className="vc-theme-switcher-check" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ThemeSwitcherButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);
    const { preset } = settings.use(["preset"]);

    return (
        <Popout
            position="bottom"
            align="right"
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <ThemePicker onClose={() => setShow(false)} />}
        >
            {(_, { isShown }) => (
                <HeaderBarIcon
                    ref={buttonRef}
                    className="vc-theme-switcher-button"
                    onClick={() => setShow(value => !value)}
                    tooltip={isShown ? null : `Theme: ${displayName(preset as Preset)}`}
                    icon={() => <ThemeIcon preset={preset as Preset} />}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

export default definePlugin({
    name: "ThemeSwitcher",
    description: "Switch MyTheme presets from the titlebar, settings, Toolbox, or /vtheme.",
    tags: ["Appearance", "Utility"],
    authors: [{ name: "sunl3ss", id: 418774298287669248n }],
    settings,

    patches: [{
        find: '?"BACK_FORWARD_NAVIGATION":',
        replacement: {
            match: /(trailing:.{0,50}?)\i\.Fragment,(?=\{children:\[)/,
            replace: "$1$self.TrailingWrapper,"
        }
    }],

    toolboxActions: Object.fromEntries(
        presetDefinitions.map(preset => [`Theme: ${preset.label}`, () => selectPreset(preset.value)])
    ),

    commands: [{
        name: "vtheme",
        description: "Switch the active MyTheme preset.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [{
            name: "preset",
            description: "black, gothic, green, purple, or red",
            required: true,
            type: ApplicationCommandOptionType.STRING
        }],
        execute: (args, context) => {
            const value = findOption<string>(args, "preset", "").trim().toLowerCase();
            if (!isPreset(value)) {
                sendBotMessage(context.channel.id, {
                    content: `Unknown preset. Use: ${presetDefinitions.map(preset => preset.value).join(", ")}.`
                });
                return;
            }

            selectPreset(value);
            sendBotMessage(context.channel.id, {
                content: `Theme switched to **${displayName(value)}**.`
            });
        }
    }],

    start() {
        void applyPreset(settings.store.preset as Preset, false);
    },

    TrailingWrapper({ children }: PropsWithChildren) {
        return (
            <>
                {children}
                <ErrorBoundary key="vc-theme-switcher" noop>
                    <ThemeSwitcherButton />
                </ErrorBoundary>
            </>
        );
    }
});
