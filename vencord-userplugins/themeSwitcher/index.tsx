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
import { createRoot, Popout, showToast, Toasts, useRef, useState } from "@webpack/common";
import type { CSSProperties } from "react";
import type { Root } from "react-dom/client";

const Native = VencordNative.pluginHelpers.ThemeSwitcher as PluginNative<typeof import("./native")>;

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

function FloatingThemeSwitcher() {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [showPicker, setShowPicker] = useState(false);
    const { preset } = settings.use(["preset"]);

    return (
        <Popout
            position="bottom"
            align="right"
            animation={Popout.Animation.NONE}
            shouldShow={showPicker}
            onRequestClose={() => setShowPicker(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <ThemePicker onClose={() => setShowPicker(false)} />}
        >
            {(_, { isShown }) => (
                <button
                    ref={buttonRef}
                    type="button"
                    className="vc-theme-switcher-fallback"
                    data-selected={isShown}
                    aria-label={`Theme: ${displayName(preset as Preset)}`}
                    onClick={() => setShowPicker(value => !value)}
                >
                    <ThemeIcon preset={preset as Preset} />
                </button>
            )}
        </Popout>
    );
}

let fallbackRoot: Root | null = null;
let fallbackContainer: HTMLDivElement | null = null;

function mountFallback() {
    if (fallbackRoot) return;

    fallbackContainer = document.createElement("div");
    fallbackContainer.id = "vc-theme-switcher-fallback-root";
    document.body.append(fallbackContainer);

    fallbackRoot = createRoot(fallbackContainer);
    fallbackRoot.render(
        <ErrorBoundary noop>
            <FloatingThemeSwitcher />
        </ErrorBoundary>
    );
}

function unmountFallback() {
    fallbackRoot?.unmount();
    fallbackContainer?.remove();
    fallbackRoot = null;
    fallbackContainer = null;
}

export default definePlugin({
    name: "ThemeSwitcher",
    description: "Switch MyTheme presets from the titlebar, settings, Toolbox, or /vtheme.",
    tags: ["Appearance", "Utility"],
    authors: [{ name: "sunl3ss", id: 418774298287669248n }],
    settings,

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
        mountFallback();
    },

    stop() {
        unmountFallback();
    }
});
