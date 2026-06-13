// HTTP 静态服务器 - 前端示例脚本

document.addEventListener("DOMContentLoaded", () => {
  console.log("静态服务器运行正常！JS 文件加载成功。");

  // 为特性卡片添加点击动画
  const cards = document.querySelectorAll(".feature-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      card.style.transform = "scale(0.95)";
      setTimeout(() => {
        card.style.transform = "";
      }, 150);
    });
  });

  // 动态显示当前时间
  const footer = document.querySelector("footer p");
  if (footer) {
    const updateTime = () => {
      const now = new Date().toLocaleString("zh-CN");
      footer.textContent = `纯 Node.js 实现 | 当前时间: ${now}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
  }
});
