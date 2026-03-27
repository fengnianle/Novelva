using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace NovelvaInstaller
{
    // ─── JSON Data Contracts ───────────────────────────────────────

    [DataContract]
    public class ReleaseInfo
    {
        [DataMember(Name = "tag_name")] public string TagName { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "assets")] public AssetInfo[] Assets { get; set; }
    }

    [DataContract]
    public class AssetInfo
    {
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "size")] public long Size { get; set; }
        [DataMember(Name = "browser_download_url")] public string DownloadUrl { get; set; }
    }

    // ─── Helpers ───────────────────────────────────────────────────

    public static class GfxHelper
    {
        public static GraphicsPath RoundedRect(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            int d = radius * 2;
            if (d > rect.Height) d = rect.Height;
            if (d > rect.Width) d = rect.Width;
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static Color GetParentBackColor(Control c)
        {
            if (c.Parent != null) return c.Parent.BackColor;
            return SystemColors.Control;
        }
    }

    // ─── Custom Rounded Panel ──────────────────────────────────────

    public class RoundedPanel : Panel
    {
        private int _radius = 12;
        private Color _fillColor = Color.White;
        private Color _borderColor = Color.FromArgb(230, 230, 230);

        public int Radius { get { return _radius; } set { _radius = value; } }
        public Color FillColor { get { return _fillColor; } set { _fillColor = value; } }
        public new Color BorderColor { get { return _borderColor; } set { _borderColor = value; } }

        public RoundedPanel()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer, true);
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            // Fill with parent's background to avoid black edges
            using (var brush = new SolidBrush(GfxHelper.GetParentBackColor(this)))
                e.Graphics.FillRectangle(brush, ClientRectangle);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(1, 1, Width - 3, Height - 3);
            using (var path = GfxHelper.RoundedRect(rect, _radius))
            using (var brush = new SolidBrush(_fillColor))
            using (var pen = new Pen(_borderColor, 1))
            {
                e.Graphics.FillPath(brush, path);
                e.Graphics.DrawPath(pen, path);
            }
        }
    }

    // ─── Flat Button (Label-based to avoid Button default chrome) ──

    public class FlatButton : Label
    {
        private Color _normalColor = Color.FromArgb(65, 130, 255);
        private Color _hoverColor = Color.FromArgb(55, 115, 235);
        private Color _foreNormal = Color.White;
        private bool _hovering;
        private bool _enabled = true;
        private int _radius = 8;

        public Color NormalColor { get { return _normalColor; } set { _normalColor = value; Invalidate(); } }
        public Color HoverColor { get { return _hoverColor; } set { _hoverColor = value; } }
        public int Radius { get { return _radius; } set { _radius = value; Invalidate(); } }

        public new bool Enabled
        {
            get { return _enabled; }
            set { _enabled = value; Cursor = value ? Cursors.Hand : Cursors.Default; Invalidate(); }
        }

        public FlatButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer, true);
            TextAlign = ContentAlignment.MiddleCenter;
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            if (_enabled) { _hovering = true; Invalidate(); }
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hovering = false; Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnClick(EventArgs e)
        {
            if (_enabled) base.OnClick(e);
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (var brush = new SolidBrush(GfxHelper.GetParentBackColor(this)))
                e.Graphics.FillRectangle(brush, ClientRectangle);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, Width - 1, Height - 1);
            Color bg;
            if (!_enabled) bg = Color.FromArgb(180, _normalColor);
            else if (_hovering) bg = _hoverColor;
            else bg = _normalColor;

            using (var path = GfxHelper.RoundedRect(rect, _radius))
            using (var brush = new SolidBrush(bg))
            {
                e.Graphics.FillPath(brush, path);
            }
            var flags = TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter;
            TextRenderer.DrawText(e.Graphics, Text, Font, rect, ForeColor, flags);
        }
    }

    // ─── Main Form ─────────────────────────────────────────────────

    public class InstallerForm : Form
    {
        private const string GITHUB_REPO = "fengnianle/Novelva";
        private const string APP_NAME = "Novelva";

        // Colors
        private readonly Color BG_COLOR = Color.FromArgb(250, 250, 252);
        private readonly Color PRIMARY = Color.FromArgb(65, 130, 255);
        private readonly Color PRIMARY_HOVER = Color.FromArgb(55, 115, 235);
        private readonly Color TEXT_COLOR = Color.FromArgb(30, 30, 40);
        private readonly Color TEXT_MUTED = Color.FromArgb(120, 120, 140);
        private readonly Color CARD_BG = Color.White;
        private readonly Color BORDER = Color.FromArgb(230, 232, 238);
        private readonly Color SUCCESS = Color.FromArgb(34, 170, 85);
        private readonly Color PROGRESS_BG = Color.FromArgb(235, 237, 242);

        // UI elements
        private Panel headerPanel;
        private Label titleLabel;
        private Label subtitleLabel;
        private RoundedPanel contentCard;
        private Label statusLabel;
        private Label detailLabel;
        private TextBox pathTextBox;
        private FlatButton browseButton;
        private Panel pathPanel;
        private FlatButton installButton;
        private FlatButton cancelButton;
        private Panel progressPanel;
        private Panel progressBarFill;
        private Label progressLabel;
        private Label progressPctLabel;
        private CheckBox desktopShortcut;
        private CheckBox startMenuShortcut;
        private CheckBox launchAfter;
        private Panel donePanel;
        private Label doneLabel;
        private FlatButton finishButton;

        // State
        private ReleaseInfo releaseInfo;
        private AssetInfo zipAsset;
        private volatile bool installing;
        private string defaultInstallDir;

        public InstallerForm()
        {
            defaultInstallDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                APP_NAME
            );
            InitUI();
            FetchReleaseInfo();
        }

        private void InitUI()
        {
            Text = APP_NAME + " 安装程序";
            Size = new Size(520, 480);
            MinimumSize = new Size(480, 440);
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = BG_COLOR;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            Font = new Font("Microsoft YaHei UI", 9f);

            // ── Header ──
            headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 90,
                BackColor = Color.White,
            };
            headerPanel.Paint += (s, e) =>
            {
                using (var pen = new Pen(BORDER))
                    e.Graphics.DrawLine(pen, 0, headerPanel.Height - 1, headerPanel.Width, headerPanel.Height - 1);
            };
            Controls.Add(headerPanel);

            // App icon circle
            var iconPanel = new Panel
            {
                Size = new Size(48, 48),
                Location = new Point(28, 20),
            };
            iconPanel.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var brush = new SolidBrush(PRIMARY))
                    e.Graphics.FillEllipse(brush, 0, 0, 47, 47);
                var nFont = new Font("Segoe UI", 18f, FontStyle.Bold);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                using (var brush = new SolidBrush(Color.White))
                    e.Graphics.DrawString("N", nFont, brush, new RectangleF(0, 0, 48, 48), sf);
                nFont.Dispose();
            };
            headerPanel.Controls.Add(iconPanel);

            titleLabel = new Label
            {
                Text = APP_NAME,
                Font = new Font("Microsoft YaHei UI", 16f, FontStyle.Bold),
                ForeColor = TEXT_COLOR,
                Location = new Point(86, 18),
                AutoSize = true,
            };
            headerPanel.Controls.Add(titleLabel);

            subtitleLabel = new Label
            {
                Text = "AI 多语言阅读学习",
                Font = new Font("Microsoft YaHei UI", 9f),
                ForeColor = TEXT_MUTED,
                Location = new Point(88, 52),
                AutoSize = true,
            };
            headerPanel.Controls.Add(subtitleLabel);

            // ── Content Card ──
            contentCard = new RoundedPanel
            {
                FillColor = CARD_BG,
                BorderColor = BORDER,
                Location = new Point(24, 105),
                Size = new Size(456, 280),
            };
            Controls.Add(contentCard);

            // Status label
            statusLabel = new Label
            {
                Text = "正在获取最新版本信息...",
                Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold),
                ForeColor = TEXT_COLOR,
                Location = new Point(24, 20),
                Size = new Size(410, 24),
            };
            contentCard.Controls.Add(statusLabel);

            detailLabel = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 8.5f),
                ForeColor = TEXT_MUTED,
                Location = new Point(24, 46),
                Size = new Size(410, 20),
            };
            contentCard.Controls.Add(detailLabel);

            // ── Path selection ──
            pathPanel = new Panel
            {
                Location = new Point(24, 76),
                Size = new Size(410, 70),
                Visible = false,
            };
            contentCard.Controls.Add(pathPanel);

            var pathLabel = new Label
            {
                Text = "安装目录",
                Font = new Font("Microsoft YaHei UI", 8.5f),
                ForeColor = TEXT_MUTED,
                Location = new Point(0, 0),
                AutoSize = true,
            };
            pathPanel.Controls.Add(pathLabel);

            pathTextBox = new TextBox
            {
                Text = defaultInstallDir,
                Location = new Point(0, 22),
                Size = new Size(330, 28),
                Font = new Font("Microsoft YaHei UI", 9f),
                BorderStyle = BorderStyle.FixedSingle,
            };
            pathPanel.Controls.Add(pathTextBox);

            browseButton = new FlatButton
            {
                Text = "浏览...",
                NormalColor = Color.FromArgb(240, 242, 248),
                HoverColor = Color.FromArgb(225, 228, 238),
                ForeColor = TEXT_COLOR,
                Font = new Font("Microsoft YaHei UI", 8.5f),
                Location = new Point(338, 21),
                Size = new Size(72, 30),
            };
            browseButton.Click += BrowseButton_Click;
            pathPanel.Controls.Add(browseButton);

            // ── Checkboxes ──
            desktopShortcut = new CheckBox
            {
                Text = "创建桌面快捷方式",
                Font = new Font("Microsoft YaHei UI", 8.5f),
                ForeColor = TEXT_COLOR,
                Location = new Point(0, 56),
                AutoSize = true,
                Checked = true,
            };
            pathPanel.Controls.Add(desktopShortcut);

            startMenuShortcut = new CheckBox
            {
                Text = "创建开始菜单快捷方式",
                Font = new Font("Microsoft YaHei UI", 8.5f),
                ForeColor = TEXT_COLOR,
                Location = new Point(170, 56),
                AutoSize = true,
                Checked = true,
            };
            pathPanel.Controls.Add(startMenuShortcut);

            // Resize pathPanel to fit checkboxes
            pathPanel.Size = new Size(410, 80);

            // ── Progress ──
            progressPanel = new Panel
            {
                Location = new Point(24, 166),
                Size = new Size(410, 60),
                Visible = false,
            };
            contentCard.Controls.Add(progressPanel);

            progressLabel = new Label
            {
                Text = "准备下载...",
                Font = new Font("Microsoft YaHei UI", 8.5f),
                ForeColor = TEXT_COLOR,
                Location = new Point(0, 0),
                Size = new Size(340, 20),
            };
            progressPanel.Controls.Add(progressLabel);

            progressPctLabel = new Label
            {
                Text = "0%",
                Font = new Font("Microsoft YaHei UI", 8.5f, FontStyle.Bold),
                ForeColor = PRIMARY,
                Location = new Point(350, 0),
                Size = new Size(60, 20),
                TextAlign = ContentAlignment.TopRight,
            };
            progressPanel.Controls.Add(progressPctLabel);

            var progressBarBg = new Panel
            {
                Location = new Point(0, 26),
                Size = new Size(410, 8),
                BackColor = PROGRESS_BG,
            };
            progressBarBg.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = new GraphicsPath())
                {
                    path.AddArc(0, 0, 8, 8, 180, 90);
                    path.AddArc(401, 0, 8, 8, 270, 90);
                    path.AddArc(401, 0, 8, 8, 0, 90);
                    path.AddArc(0, 0, 8, 8, 90, 90);
                    path.CloseFigure();
                    e.Graphics.SetClip(path);
                    e.Graphics.Clear(PROGRESS_BG);
                }
            };
            progressPanel.Controls.Add(progressBarBg);

            progressBarFill = new Panel
            {
                Location = new Point(0, 26),
                Size = new Size(0, 8),
                BackColor = PRIMARY,
            };
            progressPanel.Controls.Add(progressBarFill);
            progressBarFill.BringToFront();

            // ── Done panel ──
            donePanel = new Panel
            {
                Location = new Point(24, 76),
                Size = new Size(410, 100),
                Visible = false,
            };
            contentCard.Controls.Add(donePanel);

            doneLabel = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 9f),
                ForeColor = TEXT_COLOR,
                Location = new Point(0, 0),
                Size = new Size(410, 40),
            };
            donePanel.Controls.Add(doneLabel);

            launchAfter = new CheckBox
            {
                Text = "立即启动 " + APP_NAME,
                Font = new Font("Microsoft YaHei UI", 9f),
                ForeColor = TEXT_COLOR,
                Location = new Point(0, 48),
                AutoSize = true,
                Checked = true,
            };
            donePanel.Controls.Add(launchAfter);

            // ── Buttons ──
            installButton = new FlatButton
            {
                Text = "安装",
                NormalColor = PRIMARY,
                HoverColor = PRIMARY_HOVER,
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold),
                Size = new Size(120, 40),
                Location = new Point(360, 400),
            };
            installButton.Enabled = false;
            installButton.Click += InstallButton_Click;
            Controls.Add(installButton);

            cancelButton = new FlatButton
            {
                Text = "取消",
                NormalColor = Color.FromArgb(240, 242, 248),
                HoverColor = Color.FromArgb(225, 228, 238),
                ForeColor = TEXT_COLOR,
                Font = new Font("Microsoft YaHei UI", 9.5f),
                Size = new Size(90, 40),
                Location = new Point(260, 400),
            };
            cancelButton.Click += (s, e) =>
            {
                if (installing)
                {
                    if (MessageBox.Show("正在安装中，确定要取消吗？", APP_NAME, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                        Environment.Exit(0);
                }
                else
                {
                    Close();
                }
            };
            Controls.Add(cancelButton);

            finishButton = new FlatButton
            {
                Text = "完成",
                NormalColor = SUCCESS,
                HoverColor = Color.FromArgb(28, 150, 72),
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold),
                Size = new Size(120, 40),
                Location = new Point(360, 400),
                Visible = false,
            };
            finishButton.Click += FinishButton_Click;
            Controls.Add(finishButton);
        }

        // ── Fetch release ──────────────────────────────────────────

        private void FetchReleaseInfo()
        {
            var bgw = new BackgroundWorker();
            bgw.DoWork += (s, e) =>
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                var url = "https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.UserAgent = "Novelva-Installer";
                req.Accept = "application/json";
                using (var res = req.GetResponse())
                using (var stream = res.GetResponseStream())
                {
                    var ser = new DataContractJsonSerializer(typeof(ReleaseInfo));
                    e.Result = (ReleaseInfo)ser.ReadObject(stream);
                }
            };
            bgw.RunWorkerCompleted += (s, e) =>
            {
                if (e.Error != null)
                {
                    statusLabel.Text = "❌ 无法获取版本信息";
                    detailLabel.Text = "请检查网络连接: " + e.Error.Message;
                    return;
                }
                releaseInfo = (ReleaseInfo)e.Result;
                if (releaseInfo.Assets != null)
                {
                    foreach (var a in releaseInfo.Assets)
                    {
                        if (a.Name != null && a.Name.EndsWith(".zip") && a.Name.Contains("win32"))
                        {
                            zipAsset = a;
                            break;
                        }
                    }
                }
                if (zipAsset == null)
                {
                    statusLabel.Text = "❌ 未找到安装包";
                    detailLabel.Text = "GitHub Release 中无 Windows ZIP 文件";
                    return;
                }
                var version = releaseInfo.TagName ?? releaseInfo.Name ?? "";
                var sizeMb = (zipAsset.Size / 1024.0 / 1024.0).ToString("F1");
                statusLabel.Text = "准备安装 " + APP_NAME + " " + version;
                detailLabel.Text = zipAsset.Name + " (" + sizeMb + " MB)";
                pathPanel.Visible = true;
                installButton.Enabled = true;
            };
            bgw.RunWorkerAsync();
        }

        // ── Browse ─────────────────────────────────────────────────

        private void BrowseButton_Click(object sender, EventArgs e)
        {
            using (var dlg = new FolderBrowserDialog())
            {
                dlg.Description = "请选择 " + APP_NAME + " 的安装目录";
                dlg.SelectedPath = pathTextBox.Text;
                dlg.ShowNewFolderButton = true;
                if (dlg.ShowDialog() == DialogResult.OK)
                {
                    var sel = dlg.SelectedPath;
                    if (!sel.EndsWith(APP_NAME))
                        sel = Path.Combine(sel, APP_NAME);
                    pathTextBox.Text = sel;
                }
            }
        }

        // ── Install ────────────────────────────────────────────────

        private void InstallButton_Click(object sender, EventArgs e)
        {
            var installDir = pathTextBox.Text.Trim();
            if (string.IsNullOrEmpty(installDir))
            {
                MessageBox.Show("请选择安装目录", APP_NAME, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            installing = true;
            installButton.Enabled = false;
            pathPanel.Enabled = false;
            progressPanel.Visible = true;

            var bgw = new BackgroundWorker();
            bgw.WorkerReportsProgress = true;
            bgw.DoWork += (s2, e2) =>
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                var tempDir = Path.Combine(Path.GetTempPath(), "novelva-installer");
                Directory.CreateDirectory(tempDir);
                var zipPath = Path.Combine(tempDir, zipAsset.Name);
                var extractDir = Path.Combine(tempDir, "extracted");

                // Download
                bgw.ReportProgress(0, "正在下载...");
                using (var wc = new WebClient())
                {
                    wc.Headers.Add("User-Agent", "Novelva-Installer");
                    wc.DownloadProgressChanged += (s3, e3) =>
                    {
                        var pct = e3.ProgressPercentage;
                        var mbDone = (e3.BytesReceived / 1024.0 / 1024.0).ToString("F1");
                        var mbTotal = (e3.TotalBytesToReceive / 1024.0 / 1024.0).ToString("F1");
                        bgw.ReportProgress(pct, "正在下载 " + mbDone + " / " + mbTotal + " MB");
                    };
                    wc.DownloadFileTaskAsync(new Uri(zipAsset.DownloadUrl), zipPath).Wait();
                }

                // Extract
                bgw.ReportProgress(100, "正在解压...");
                if (Directory.Exists(extractDir))
                    Directory.Delete(extractDir, true);
                ZipFile.ExtractToDirectory(zipPath, extractDir);

                // Find source dir (ZIP may contain a top-level folder)
                var items = Directory.GetDirectories(extractDir);
                var sourceDir = extractDir;
                if (items.Length == 1)
                    sourceDir = items[0];

                // Copy to install dir
                bgw.ReportProgress(100, "正在安装文件...");
                Directory.CreateDirectory(installDir);
                CopyDirectory(sourceDir, installDir);

                // Shortcuts
                var exePath = Path.Combine(installDir, APP_NAME + ".exe");
                if ((bool)e2.Argument == true) // desktop shortcut
                {
                    bgw.ReportProgress(100, "创建桌面快捷方式...");
                    CreateShortcutViaPS(exePath, APP_NAME,
                        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
                }

                // Start menu shortcut - store in e2.Result whether to create
                bgw.ReportProgress(100, "创建开始菜单快捷方式...");
                var startMenuDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "Microsoft", "Windows", "Start Menu", "Programs");
                CreateShortcutViaPS(exePath, APP_NAME, startMenuDir);

                // Cleanup
                try { File.Delete(zipPath); } catch { }
                try { Directory.Delete(tempDir, true); } catch { }

                e2.Result = exePath;
            };
            bgw.ProgressChanged += (s2, e2) =>
            {
                var pct = Math.Min(e2.ProgressPercentage, 100);
                progressLabel.Text = (string)e2.UserState;
                progressPctLabel.Text = pct + "%";
                progressBarFill.Size = new Size((int)(410.0 * pct / 100), 8);
            };
            bgw.RunWorkerCompleted += (s2, e2) =>
            {
                installing = false;
                if (e2.Error != null)
                {
                    progressLabel.Text = "❌ 安装失败";
                    progressLabel.ForeColor = Color.Red;
                    detailLabel.Text = e2.Error.Message;
                    installButton.Enabled = true;
                    pathPanel.Enabled = true;
                    return;
                }

                // Show done state
                statusLabel.Text = "✅ 安装完成！";
                statusLabel.ForeColor = SUCCESS;
                detailLabel.Text = "";
                pathPanel.Visible = false;
                progressPanel.Visible = false;
                installButton.Visible = false;
                cancelButton.Visible = false;

                doneLabel.Text = APP_NAME + " 已成功安装到:\n" + installDir;
                donePanel.Visible = true;
                finishButton.Visible = true;
                finishButton.Tag = e2.Result; // exePath
            };

            bgw.RunWorkerAsync(desktopShortcut.Checked);
        }

        // ── Finish ─────────────────────────────────────────────────

        private void FinishButton_Click(object sender, EventArgs e)
        {
            var exePath = finishButton.Tag as string;
            if (launchAfter.Checked && exePath != null && File.Exists(exePath))
            {
                var psi = new ProcessStartInfo();
                psi.FileName = exePath;
                psi.WorkingDirectory = Path.GetDirectoryName(exePath);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            Close();
        }

        // ── Helpers ────────────────────────────────────────────────

        private static void CopyDirectory(string src, string dst)
        {
            Directory.CreateDirectory(dst);
            foreach (var file in Directory.GetFiles(src))
            {
                var destFile = Path.Combine(dst, Path.GetFileName(file));
                File.Copy(file, destFile, true);
            }
            foreach (var dir in Directory.GetDirectories(src))
            {
                CopyDirectory(dir, Path.Combine(dst, Path.GetFileName(dir)));
            }
        }

        private static void CreateShortcutViaPS(string exePath, string name, string folder)
        {
            try
            {
                var lnk = Path.Combine(folder, name + ".lnk");
                var ps = string.Format(
                    "$ws=New-Object -ComObject WScript.Shell;" +
                    "$sc=$ws.CreateShortcut('{0}');" +
                    "$sc.TargetPath='{1}';" +
                    "$sc.WorkingDirectory='{2}';" +
                    "$sc.Description='Novelva - AI 多语言阅读学习';" +
                    "$sc.Save()",
                    lnk.Replace("'", "''"),
                    exePath.Replace("'", "''"),
                    Path.GetDirectoryName(exePath).Replace("'", "''")
                );
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"" + ps + "\"",
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                };
                var p = Process.Start(psi);
                p.WaitForExit(5000);
            }
            catch { }
        }
    }

    // ─── Entry Point ───────────────────────────────────────────────

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}
