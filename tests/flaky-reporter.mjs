/**
 * CI 開了 vitest retry 後，「retry 才通過」的 case 在預設 reporter 裡看不出來。
 * 這個 reporter 只負責把它們以 GitHub 警告註解印出來（本機不開 retry，不會觸發）。
 */
export default class FlakyReporter {
  onTestRunEnd(testModules) {
    for (const mod of testModules) {
      for (const t of mod.children.allTests()) {
        const d = t.diagnostic();
        if (d?.flaky) console.log(`::warning title=flaky test::${t.fullName}（${mod.moduleId}）retry ${d.retryCount} 次後才通過`);
      }
    }
  }
}
