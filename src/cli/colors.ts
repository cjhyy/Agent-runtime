/**
 * CLI 颜色和输出工具
 */

/** ANSI 颜色代码 */
export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
} as const

export type ColorName = keyof typeof colors

/** 带颜色的打印函数 */
export function print(text: string, color?: ColorName): void {
  if (color) {
    console.log(`${colors[color]}${text}${colors.reset}`)
  } else {
    console.log(text)
  }
}

/** 打印分隔线 */
export function printSeparator(char = "━", length = 40): void {
  print(char.repeat(length), "dim")
}

/** 打印标题框 */
export function printHeader(title: string, width = 41): void {
  const padding = Math.max(0, width - title.length - 4)
  const left = Math.floor(padding / 2)
  const right = padding - left

  console.log()
  print("╔" + "═".repeat(width - 2) + "╗", "cyan")
  print("║" + " ".repeat(left) + title + " ".repeat(right) + "║", "cyan")
  print("╚" + "═".repeat(width - 2) + "╝", "cyan")
  console.log()
}

/** 打印带图标的状态消息 */
export function printStatus(icon: string, message: string, color: ColorName = "dim"): void {
  print(`${icon} ${message}`, color)
}

/** 打印成功消息 */
export function printSuccess(message: string): void {
  printStatus("✅", message, "green")
}

/** 打印警告消息 */
export function printWarning(message: string): void {
  printStatus("⚠️", message, "yellow")
}

/** 打印错误消息 */
export function printError(message: string): void {
  printStatus("❌", message, "red")
}

/** 打印信息消息 */
export function printInfo(message: string): void {
  printStatus("ℹ️", message, "cyan")
}
