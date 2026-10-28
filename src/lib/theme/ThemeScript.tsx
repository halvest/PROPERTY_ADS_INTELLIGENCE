export function ThemeScript() {
  const code = `(function(){try{
    var m = document.cookie.match(/(?:^|; )app_theme=([^;]*)/);
    var t = m ? decodeURIComponent(m[1]) : null;
    if(!t) { t = localStorage.getItem("app_theme"); }
    var resolved = t;
    if(!t || t === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
    if(resolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
