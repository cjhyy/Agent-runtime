/**
 * 标签页和弹窗管理模块
 */

import type { Page, Dialog } from "playwright"
import { browserLogger as logger } from "../../logger.js"
import { getContext, getPage, setActivePage } from "./core.js"
import type { TabInfo, TabsResult, DialogResult } from "./types.js"

// ===== 标签页管理 =====

/** 获取所有标签页信息 */
export async function browserTabsList(): Promise<TabsResult> {
  const context = getContext()
  const currentPage = getPage()
  const pages = context.pages()

  const tabs: TabInfo[] = await Promise.all(
    pages.map(async (page, index) => ({
      index,
      url: page.url(),
      title: await page.title().catch(() => ""),
      active: page === currentPage,
    }))
  )

  const activeIndex = tabs.findIndex((t) => t.active)

  return {
    action: "list",
    tabs,
    activeIndex,
  }
}

/** 创建新标签页 */
export async function browserTabsNew(url?: string): Promise<TabsResult> {
  const context = getContext()

  const newPage = await context.newPage()
  if (url) {
    await newPage.goto(url, { waitUntil: "domcontentloaded" })
  }

  // 更新当前活动页面引用
  setActivePage(newPage)

  return browserTabsList()
}

/** 关闭标签页 */
export async function browserTabsClose(index?: number): Promise<TabsResult> {
  const context = getContext()
  const pages = context.pages()

  // 如果没指定 index，关闭当前页
  const targetIndex = index ?? pages.findIndex((p) => p === getPage())

  if (targetIndex < 0 || targetIndex >= pages.length) {
    throw new Error(`Invalid tab index: ${targetIndex}`)
  }

  const pageToClose = pages[targetIndex]
  await pageToClose.close()

  // 如果关闭的是当前页，切换到其他页
  if (pageToClose === getPage()) {
    const remainingPages = context.pages()
    if (remainingPages.length > 0) {
      const newIndex = Math.min(targetIndex, remainingPages.length - 1)
      setActivePage(remainingPages[newIndex])
    }
  }

  return browserTabsList()
}

/** 切换到指定标签页 */
export async function browserTabsSwitch(index: number): Promise<TabsResult> {
  const context = getContext()
  const pages = context.pages()

  if (index < 0 || index >= pages.length) {
    throw new Error(`Invalid tab index: ${index}. Available: 0-${pages.length - 1}`)
  }

  const targetPage = pages[index]
  setActivePage(targetPage)

  // 聚焦页面
  await targetPage.bringToFront()

  return browserTabsList()
}

/** 统一的标签页操作接口 */
export async function browserTabs(
  action: "list" | "new" | "close" | "switch",
  options?: { index?: number; url?: string }
): Promise<TabsResult> {
  switch (action) {
    case "list":
      return browserTabsList()
    case "new":
      return browserTabsNew(options?.url)
    case "close":
      return browserTabsClose(options?.index)
    case "switch":
      if (options?.index === undefined) {
        throw new Error("Tab index required for switch action")
      }
      return browserTabsSwitch(options.index)
    default:
      throw new Error(`Unknown tabs action: ${action}`)
  }
}

// ===== 弹窗处理 =====

/** 当前待处理的弹窗 */
let pendingDialog: Dialog | null = null
let dialogInfo: { type: string; message: string } | null = null

/** 设置弹窗监听器 */
export function setupDialogHandler(page: Page): void {
  page.on("dialog", (dialog) => {
    pendingDialog = dialog
    dialogInfo = {
      type: dialog.type(),
      message: dialog.message(),
    }
    logger.info(`Dialog appeared: [${dialog.type()}] ${dialog.message()}`)
  })
}

/** 处理弹窗 */
export async function browserDialog(
  accept: boolean,
  promptText?: string
): Promise<DialogResult> {
  if (!pendingDialog) {
    return {
      handled: false,
      dialogType: "none",
      message: "No pending dialog",
    }
  }

  const info = dialogInfo!

  if (accept) {
    await pendingDialog.accept(promptText)
  } else {
    await pendingDialog.dismiss()
  }

  // 清除状态
  pendingDialog = null
  dialogInfo = null

  return {
    handled: true,
    dialogType: info.type,
    message: info.message,
  }
}

/** 检查是否有待处理的弹窗 */
export function hasPendingDialog(): boolean {
  return pendingDialog !== null
}

/** 获取待处理弹窗信息 */
export function getPendingDialogInfo(): { type: string; message: string } | null {
  return dialogInfo
}

