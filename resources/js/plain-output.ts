export function plainOutput(text: string): string {
    return text.replace(
        /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\))/g,
        "",
    );
}
