/**
 * Master Admin Console Application Controller (Multi-Tenant Platform Engine)
 * Powered by PlatformStore, RBAC Security, FileVault, and Full-Spec QRCodeEngine
 */
(function (global) {
  'use strict';

  const UI = {
    currentView: 'view-platform-overview',
    kpiRange: '30d'
  };

  function db() { return global.PlatformStore.load(); }
  function esc(s) { return global.Security.escapeHTML(s); }

  let toastTimer = null;
  function showToast(msg) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    if (toastTimer) clearTimeout(toastTimer);
    c.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    toastTimer = setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 250);
    }, 2200);
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const MasterAdminApp = {
    init: function () {
      MasterAdminApp.checkAccess();
      MasterAdminApp.applyTheme();
      MasterAdminApp.updateSidebarBadges();

      // Render initial overview view
      MasterAdminApp.renderPlatformOverview();

      // Restore desktop sidebar collapse preference
      if (window.innerWidth > 1024) {
        try {
          if (localStorage.getItem('admin_sidebar_collapsed') === '1') {
            const layout = document.getElementById('admin-layout') || document.querySelector('.admin-layout');
            if (layout) layout.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
            const topToggle = document.getElementById('btn-sidebar-toggle');
            if (topToggle) {
              topToggle.setAttribute('title', 'Expand sidebar');
              topToggle.setAttribute('aria-label', 'Expand sidebar');
              topToggle.classList.add('collapsed');
            }
          }
        } catch (e) {}
      }

      document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          const inp = document.getElementById('topbar-global-search');
          if (inp) inp.focus();
        }
      });

      // Subscribe to changes in PlatformStore
      global.PlatformStore.subscribe(function () {
        MasterAdminApp.checkAccess();
        MasterAdminApp.applyTheme();
        MasterAdminApp.updateSidebarBadges();
        MasterAdminApp.renderActiveView();
      });

      // Close sidebar on mobile when clicking or tapping outside
      document.addEventListener('click', function (e) {
        const sidebar = document.getElementById('admin-sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        if (!sidebar || !sidebar.classList.contains('open')) return;
        if (!sidebar.contains(e.target) && (!hamburger || !hamburger.contains(e.target))) {
          MasterAdminApp.closeSidebar();
        }
      }, true);

      document.addEventListener('touchstart', function (e) {
        const sidebar = document.getElementById('admin-sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        if (!sidebar || !sidebar.classList.contains('open')) return;
        if (!sidebar.contains(e.target) && (!hamburger || !hamburger.contains(e.target))) {
          MasterAdminApp.closeSidebar();
        }
      }, { passive: true });
    },

    checkAccess: function () {
      const session = global.RBAC.getSession();
      const isAuthorized = session && session.role === 'master_admin';

      if (!isAuthorized) {
        if (session && session.role === 'tenant_admin') {
          window.location.replace('tenant-admin.html');
          return false;
        }
        if (session && session.role === 'card_user') {
          window.location.replace('index.html');
          return false;
        }
        window.location.replace('master-login.html');
        return false;
      }

      const meta = global.RBAC.getRoleMeta(session.role);
      const guard = document.getElementById('rbac-guard-overlay');
      if (guard) {
        guard.style.display = 'none';
      }

      // Update sidebar user display
      const sideName = document.getElementById('sidebar-user-name');
      const sideRole = document.getElementById('sidebar-user-role');
      const sideAvatar = document.getElementById('sidebar-user-avatar');

      if (sideName) sideName.textContent = session.name || 'Platform Owner';
      if (sideRole) sideRole.textContent = meta.label;
      if (sideAvatar) sideAvatar.textContent = (session.name || 'PO').split(' ').map(function(w){return w[0];}).join('').slice(0, 2).toUpperCase();
    },

    applyTheme: function () {
      const store = db();
      document.documentElement.setAttribute('data-theme', store.uiTheme || 'light');
    },

    toggleTheme: function () {
      const store = db();
      const next = (store.uiTheme || 'light') === 'light' ? 'dark' : 'light';
      store.uiTheme = next;
      global.PlatformStore.save();
      MasterAdminApp.applyTheme();
      showToast('Theme switched to ' + next + ' mode');
    },

    toggleSidebar: function () {
      const isMobile = window.innerWidth <= 1024;
      const sidebar = document.getElementById('admin-sidebar');
      const layout = document.getElementById('admin-layout') || document.querySelector('.admin-layout');
      const backdrop = document.getElementById('sidebar-backdrop');
      const topToggle = document.getElementById('btn-sidebar-toggle');
      if (!sidebar) return;

      if (isMobile) {
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
          MasterAdminApp.closeSidebar();
        } else {
          sidebar.classList.add('open');
          document.body.classList.add('mobile-sidebar-open');
          if (topToggle) {
            topToggle.classList.add('is-open');
            topToggle.setAttribute('title', 'Close navigation menu');
            topToggle.setAttribute('aria-label', 'Close navigation menu');
          }
          if (backdrop) {
            backdrop.classList.add('open');
            backdrop.classList.add('active');
          }
        }
      } else {
        if (layout) {
          const isCollapsed = layout.classList.toggle('collapsed');
          document.body.classList.toggle('sidebar-collapsed', isCollapsed);
          const tip = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
          if (topToggle) {
            topToggle.setAttribute('title', tip);
            topToggle.setAttribute('aria-label', tip);
            topToggle.classList.toggle('collapsed', isCollapsed);
          }
          try {
            localStorage.setItem('admin_sidebar_collapsed', isCollapsed ? '1' : '0');
          } catch (e) {}
        }
      }
    },

    closeSidebar: function () {
      const sidebar = document.getElementById('admin-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      const topToggle = document.getElementById('btn-sidebar-toggle');
      if (sidebar) sidebar.classList.remove('open');
      document.body.classList.remove('mobile-sidebar-open');
      if (topToggle) {
        topToggle.classList.remove('is-open');
        topToggle.setAttribute('title', 'Open navigation menu');
        topToggle.setAttribute('aria-label', 'Open navigation menu');
      }
      if (backdrop) {
        backdrop.classList.remove('open');
        backdrop.classList.remove('active');
      }
    },

    showView: function (viewId) {
      UI.currentView = viewId;
      MasterAdminApp.closeSidebar();

      document.querySelectorAll('.view-section').forEach(function (s) {
        s.classList.remove('active');
        s.style.display = 'none';
      });

      const target = document.getElementById(viewId);
      if (target) {
        target.classList.add('active');
        target.style.display = 'block';
      }

      document.querySelectorAll('#master-sidebar-nav .sidebar-item').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
      });

      MasterAdminApp.renderActiveView();
      const main = document.querySelector('.admin-main');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    },

    handleGlobalSearch: function (query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        MasterAdminApp.renderActiveView();
        return;
      }
      if (UI.currentView === 'view-tenants') {
        const rows = document.querySelectorAll('#tenants-table-body tr');
        rows.forEach(function (r) {
          const txt = r.textContent.toLowerCase();
          r.style.display = txt.includes(q) ? '' : 'none';
        });
      } else if (UI.currentView === 'view-rbac') {
        const rows = document.querySelectorAll('#users-table-body tr');
        rows.forEach(function (r) {
          const txt = r.textContent.toLowerCase();
          r.style.display = txt.includes(q) ? '' : 'none';
        });
      } else if (UI.currentView === 'view-audit') {
        const rows = document.querySelectorAll('#audit-log-body tr');
        rows.forEach(function (r) {
          const txt = r.textContent.toLowerCase();
          r.style.display = txt.includes(q) ? '' : 'none';
        });
      }
    },

    renderActiveView: function () {
      switch (UI.currentView) {
        case 'view-platform-overview':
          MasterAdminApp.renderPlatformOverview();
          break;
        case 'view-tenants':
          MasterAdminApp.renderTenants();
          break;
        case 'view-rbac':
          MasterAdminApp.renderRBAC();
          break;
        case 'view-audit':
          MasterAdminApp.renderAuditLog();
          break;
        case 'view-backup':
          break;
      }
    },

    updateSidebarBadges: function () {
      const store = db();
      const set = function (id, val) { const el = document.getElementById(id); if (el) el.textContent = String(val); };
      set('badge-tenants', (store.tenants || []).length);
      set('badge-users', (store.users || []).length);
      set('badge-audits', (store.auditLog || []).length);
    },

    setTimeRange: function (range) {
      UI.kpiRange = range;
      document.querySelectorAll('#view-platform-overview .range-group .range-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-range') === range);
      });
      MasterAdminApp.renderPlatformOverview();
      showToast('Dashboard metrics filtered: ' + range);
    },

    // ------------------------------------------------------------------------
    // VIEW 1: PLATFORM OVERVIEW / DASHBOARD
    // ------------------------------------------------------------------------
    renderPlatformOverview: function () {
      const store = db();
      const kpisEl = document.getElementById('platform-kpis');
      if (!kpisEl) return;

      const tenantsCount = (store.tenants || []).length;
      const usersCount = (store.users || []).length;
      const totalLeads = (store.leads || []).length;

      let leadsMetric = totalLeads;
      let trendText = '+24%';
      let leadsSub = 'Aggregated commercial inquiries';
      let sysUptime = '99.98%';
      let activeTenantsTrend = 'Live';

      if (UI.kpiRange === '7d') {
        leadsMetric = Math.max(1, Math.round(totalLeads * 0.35));
        trendText = '+12% this week';
        leadsSub = 'Active inquiries across 7 days';
        sysUptime = '100.0%';
        activeTenantsTrend = '+0 new';
      } else if (UI.kpiRange === '90d') {
        leadsMetric = Math.round(totalLeads * 2.85);
        trendText = '+38% this quarter';
        leadsSub = 'Quarterly cross-tenant volume';
        sysUptime = '99.95%';
        activeTenantsTrend = '+2 orgs';
      } else {
        leadsMetric = totalLeads;
        trendText = '+24% this month';
        leadsSub = 'Aggregated 30-day inquiries';
        sysUptime = '99.98%';
        activeTenantsTrend = 'Live';
      }

      kpisEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Organizations</span>
            <span class="kpi-trend up">${activeTenantsTrend}</span>
          </div>
          <div class="kpi-val">${tenantsCount}</div>
          <div class="kpi-sub">Multi-tenant instances provisioned</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Platform Accounts</span>
            <span class="kpi-trend up">+1</span>
          </div>
          <div class="kpi-val">${usersCount}</div>
          <div class="kpi-sub">Governed by RBAC security roles</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Cross-Tenant Inquiries</span>
            <span class="kpi-trend up">${trendText}</span>
          </div>
          <div class="kpi-val">${leadsMetric}</div>
          <div class="kpi-sub">${leadsSub}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">System Health</span>
            <span class="kpi-trend up">Healthy</span>
          </div>
          <div class="kpi-val">${sysUptime}</div>
          <div class="kpi-sub">IndexedDB Vault &amp; Sync Online</div>
        </div>
      `;

      // Overview tenants peek
      const ovTenants = document.getElementById('overview-tenants-list');
      if (ovTenants) {
        let th = '<div style="display:flex;flex-direction:column;gap:10px;">';
        (store.tenants || []).slice(0, 4).forEach(function (t) {
          th += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);">
            <div>
              <strong style="font-size:14px;color:var(--text-main);">${esc(t.name)}</strong><br>
              <span style="font-size:12px;color:var(--text-soft);display:inline-block;margin-top:2px;">${esc(t.industry || 'Machinery')} &middot; ${esc(t.plan)} Plan</span>
            </div>
            <span class="badge ${t.status==='Active'?'badge-active':'badge-draft'}" style="font-size:12px;padding:4px 10px;">${esc(t.status)}</span>
          </div>`;
        });
        th += '</div>';
        ovTenants.innerHTML = th;
      }

      // Overview audit peek
      const ovAudit = document.getElementById('overview-audit-list');
      if (ovAudit) {
        let ah = '<div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">';
        (store.auditLog || []).slice(0, 4).forEach(function (a) {
          ah += `<div style="padding:12px 14px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;color:var(--text-soft);font-size:12px;margin-bottom:4px;">
              <span><strong>${esc(a.actor)}</strong> (${esc(a.role)})</span>
              <span>${esc(a.time)}</span>
            </div>
            <div style="font-weight:700;font-size:13.5px;color:var(--text-main);">${esc(a.action)}</div>
            ${a.details ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.4;">${esc(a.details)}</div>` : ''}
          </div>`;
        });
        ah += '</div>';
        ovAudit.innerHTML = ah;
      }
    },

    // ------------------------------------------------------------------------
    // VIEW 2: ALL ORGANIZATIONS / TENANTS
    // ------------------------------------------------------------------------
    renderTenants: function () {
      const store = db();
      const tbody = document.getElementById('tenants-table-body');
      if (!tbody) return;

      const tenants = store.tenants || [];
      let h = '';
      tenants.forEach(function (t) {
        h += `<tr>
          <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-soft);">${esc(t.id)}</td>
          <td>
            <strong style="font-size:13.5px;">${esc(t.name)}</strong><br>
            <span style="font-size:12px;color:var(--text-soft);">/${esc(t.slug || 'tenant')}</span>
          </td>
          <td style="font-size:13px;">${esc(t.industry || 'Manufacturing')}</td>
          <td><span class="badge badge-active" style="background:var(--accent-light);color:var(--accent);">${esc(t.plan || 'Enterprise')}</span></td>
          <td><span class="badge ${t.status==='Active'?'badge-active':'badge-draft'}">${esc(t.status)}</span></td>
          <td style="font-size:12px;color:var(--text-soft);">${esc(t.joined || '2026')}</td>
          <td style="text-align:right;">
            <a class="btn-secondary-sm" href="tenant-admin.html" style="text-decoration:none;margin-right:6px;">Manage Tenant</a>
            <button class="btn-secondary-sm" onclick="MasterAdminApp.toggleTenantStatus('${esc(t.id)}')" style="color:${t.status==='Active'?'#ef4444':'#22c55e'};">
              ${t.status==='Active'?'Suspend':'Activate'}
            </button>
          </td>
        </tr>`;
      });
      tbody.innerHTML = h;
    },

    openTenantModal: function () {
      document.getElementById('ten-name-inp').value = '';
      document.getElementById('ten-ind-inp').value = '';
      document.getElementById('ten-plan-inp').value = 'Enterprise';
      const aName = document.getElementById('ten-admin-name-inp');
      const aEmail = document.getElementById('ten-admin-email-inp');
      const aPass = document.getElementById('ten-admin-pass-inp');
      if (aName) aName.value = '';
      if (aEmail) aEmail.value = '';
      if (aPass) aPass.value = '';
      document.getElementById('modal-tenant').style.display = 'flex';
    },

    saveTenant: function (e) {
      e.preventDefault();
      const name = document.getElementById('ten-name-inp').value.trim();
      const ind = document.getElementById('ten-ind-inp').value.trim();
      const plan = document.getElementById('ten-plan-inp').value;

      if (!name || !ind) return;

      const store = db();
      if (!Array.isArray(store.tenants)) store.tenants = [];

      const newId = 'TEN-00' + (store.tenants.length + 1);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      store.tenants.push({
        id: newId,
        name: name,
        slug: slug,
        industry: ind,
        plan: plan,
        status: 'Active',
        joined: global.Security.formatDateShort()
      });

      // Optional auto-creation of initial Tenant Admin
      const aNameInp = document.getElementById('ten-admin-name-inp');
      const aEmailInp = document.getElementById('ten-admin-email-inp');
      const aPassInp = document.getElementById('ten-admin-pass-inp');
      const adminEmail = aEmailInp ? aEmailInp.value.trim().toLowerCase() : '';
      if (adminEmail) {
        const adminName = (aNameInp ? aNameInp.value.trim() : '') || (name + ' Admin');
        const adminPass = (aPassInp ? aPassInp.value.trim() : '') || 'admin';
        if (!Array.isArray(store.users)) store.users = [];
        const usrId = 'USR-0' + (store.users.length + 1);
        store.users.push({
          id: usrId,
          name: adminName,
          email: adminEmail,
          role: 'tenant_admin',
          password: adminPass,
          pin: adminPass,
          tenant: name,
          status: 'Active'
        });
        global.PlatformStore.logAudit('Tenant Admin Provisioned', 'Created admin ' + adminName + ' (' + adminEmail + ') for ' + name);
      }

      global.PlatformStore.logAudit('Tenant Provisioned', 'Created organization ' + name + ' (' + newId + ')');
      global.PlatformStore.save();

      MasterAdminApp.closeModal('modal-tenant');
      MasterAdminApp.renderTenants();
      MasterAdminApp.updateSidebarBadges();
      showToast('Organization ' + name + ' provisioned successfully!');
    },

    toggleTenantStatus: function (tenantId) {
      const store = db();
      const tenant = (store.tenants || []).find(function (t) { return t.id === tenantId; });
      if (tenant) {
        tenant.status = tenant.status === 'Active' ? 'Suspended' : 'Active';
        global.PlatformStore.logAudit('Tenant Status Changed', tenant.name + ' marked as ' + tenant.status);
        global.PlatformStore.save();
        MasterAdminApp.renderTenants();
        showToast('Tenant ' + tenant.name + ' is now ' + tenant.status);
      }
    },

    // ------------------------------------------------------------------------
    // VIEW 3: USERS & RBAC MATRIX
    // ------------------------------------------------------------------------
    renderRBAC: function () {
      const store = db();

      // 1. Users Table
      const tbody = document.getElementById('users-table-body');
      if (tbody) {
        const users = store.users || [];
        let h = '';
        users.forEach(function (u) {
          const meta = global.RBAC.getRoleMeta(u.role);
          h += `<tr>
            <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-soft);">${esc(u.id)}</td>
            <td>
              <strong>${esc(u.name)}</strong><br>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">${esc(u.email)}</span>
            </td>
            <td><span class="badge" style="background:${meta.color}22;color:${meta.color};font-weight:700;">${esc(meta.label)}</span></td>
            <td style="font-size:12px;">${esc(u.tenant || 'Global')}</td>
            <td><span class="badge ${u.status==='Active'?'badge-active':'badge-draft'}">${esc(u.status)}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-soft);letter-spacing:2px;">${u.pin ? '••••' : 'None'}</td>
            <td style="text-align:right;">
              <button class="btn-secondary-sm" onclick="MasterAdminApp.toggleUserStatus('${esc(u.id)}')" style="color:${u.status==='Active'?'#ef4444':'#22c55e'};">
                ${u.status==='Active'?'Suspend':'Activate'}
              </button>
            </td>
          </tr>`;
        });
        tbody.innerHTML = h;
      }

      // 2. Interactive Permissions Matrix
      const matrixTable = document.getElementById('rbac-matrix-table');
      if (matrixTable && global.RBAC) {
        const roles = ['master_admin', 'tenant_admin', 'card_user', 'viewer'];
        const perms = global.RBAC.ALL_PERMISSIONS || [];

        let mh = '<thead><tr>';
        mh += '<th style="width:34%;">Capability / Permission</th>';
        mh += '<th style="width:18%;">Module Category</th>';
        roles.forEach(function (r) {
          const meta = global.RBAC.getRoleMeta(r);
          mh += `<th style="text-align:center;width:12%;color:${meta.color};">${esc(meta.label)}</th>`;
        });
        mh += '</tr></thead><tbody>';

        perms.forEach(function (p) {
          mh += '<tr>';
          mh += `<td><strong>${esc(p.name)}</strong><br><span style="color:var(--text-soft);font-size:11px;">${esc(p.desc)}</span></td>`;
          mh += `<td><span style="padding:2px 8px;border-radius:4px;background:var(--bg-input);font-weight:600;font-size:11px;">${esc(p.module)}</span></td>`;

          roles.forEach(function (r) {
            const has = global.RBAC.roleHasPermission(r, p.id);
            mh += `<td style="text-align:center;">${has ? '<span class="matrix-check">✓</span>' : '<span class="matrix-cross">-</span>'}</td>`;
          });
          mh += '</tr>';
        });

        mh += '</tbody>';
        matrixTable.innerHTML = mh;
      }
    },

    openUserModal: function () {
      const store = db();
      document.getElementById('usr-name-inp').value = '';
      document.getElementById('usr-email-inp').value = '';
      document.getElementById('usr-role-inp').value = 'tenant_admin';
      document.getElementById('usr-pin-inp').value = '';

      const tenSelect = document.getElementById('usr-tenant-inp');
      if (tenSelect) {
        tenSelect.innerHTML = (store.tenants || []).map(function (t) {
          return `<option value="${esc(t.name)}">${esc(t.name)}</option>`;
        }).join('') + '<option value="Platform Global">Platform Global</option>';
      }

      document.getElementById('modal-user').style.display = 'flex';
    },

    saveUser: function (e) {
      e.preventDefault();
      const name = document.getElementById('usr-name-inp').value.trim();
      const email = document.getElementById('usr-email-inp').value.trim();
      const role = document.getElementById('usr-role-inp').value;
      const pin = document.getElementById('usr-pin-inp').value.trim();
      const tenant = document.getElementById('usr-tenant-inp').value;

      if (!name || !email) return;

      const store = db();
      if (!Array.isArray(store.users)) store.users = [];

      const newId = 'USR-0' + (store.users.length + 1);
      store.users.push({
        id: newId,
        name: name,
        email: email.toLowerCase(),
        role: role,
        password: pin || 'admin',
        pin: pin || '1234',
        tenant: tenant,
        status: 'Active'
      });

      global.PlatformStore.logAudit('User Created', 'Created ' + name + ' (' + email + ') with role ' + global.RBAC.getRoleMeta(role).label);
      global.PlatformStore.save();

      MasterAdminApp.closeModal('modal-user');
      MasterAdminApp.renderRBAC();
      MasterAdminApp.updateSidebarBadges();
      showToast('User account created for ' + name);
    },

    toggleUserStatus: function (userId) {
      const store = db();
      const user = (store.users || []).find(function (u) { return u.id === userId; });
      if (user) {
        if (user.role === 'master_admin') {
          showToast('Cannot suspend platform master admin account.');
          return;
        }
        user.status = user.status === 'Active' ? 'Suspended' : 'Active';
        global.PlatformStore.logAudit('User Status Changed', user.name + ' marked as ' + user.status);
        global.PlatformStore.save();
        MasterAdminApp.renderRBAC();
        showToast('User ' + user.name + ' is now ' + user.status);
      }
    },

    // ------------------------------------------------------------------------
    // VIEW 4: SECURITY AUDIT LOG
    // ------------------------------------------------------------------------
    renderAuditLog: function () {
      const store = db();
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      const logs = store.auditLog || [];
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-soft);">No security audit events recorded yet.</td></tr>';
        return;
      }

      let h = '';
      logs.forEach(function (a) {
        h += `<tr>
          <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-soft);">${esc(a.id)}</td>
          <td style="font-size:12px;color:var(--text-soft);white-space:nowrap;">${esc(a.time)}</td>
          <td><strong>${esc(a.actor)}</strong></td>
          <td><span class="badge" style="background:var(--bg-input);font-weight:600;">${esc(a.role)}</span></td>
          <td style="font-weight:600;">${esc(a.action)}</td>
          <td style="font-size:12px;color:var(--text-muted);">${esc(a.details || '')}</td>
        </tr>`;
      });
      tbody.innerHTML = h;
    },

    exportAuditCSV: function () {
      const store = db();
      const logs = store.auditLog || [];
      if (logs.length === 0) {
        showToast('No audit entries to export.');
        return;
      }

      let csv = 'Audit ID,Timestamp,Actor,Role,Action,Details\n';
      logs.forEach(function (a) {
        csv += [
          global.Security.csvCell(a.id),
          global.Security.csvCell(a.time),
          global.Security.csvCell(a.actor),
          global.Security.csvCell(a.role),
          global.Security.csvCell(a.action),
          global.Security.csvCell(a.details)
        ].join(',') + '\n';
      });

      downloadFile('platform-security-audit-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8;');
      showToast('Exported ' + logs.length + ' audit entries to CSV');
    },

    // ------------------------------------------------------------------------
    // VIEW 5: DATA BACKUP
    // ------------------------------------------------------------------------
    exportFullBackup: function () {
      const store = db();
      const json = JSON.stringify(store, null, 2);
      downloadFile('mecard-full-database-backup-' + new Date().toISOString().slice(0, 10) + '.json', json, 'application/json');
      global.PlatformStore.logAudit('Database Exported', 'Full platform database JSON backup downloaded');
      showToast('Full database JSON backup downloaded.');
    },

    resetPlatformData: function () {
      if (confirm('Are you sure you want to reset all tenants, catalog products, and CRM leads back to factory demonstration defaults?')) {
        global.PlatformStore.resetAll();
        showToast('Database reset to demonstration defaults.');
        window.location.reload();
      }
    },

    // ------------------------------------------------------------------------
    // SESSION & AUTH
    // ------------------------------------------------------------------------
    switchRole: function (role) {
      const res = global.RBAC.switchQuickRole(role);
      if (res.ok) {
        MasterAdminApp.checkAccess();
        MasterAdminApp.closeModal('modal-admin-auth');
        showToast('Switched session to ' + global.RBAC.getRoleMeta(role).label);
        if (role === 'tenant_admin') {
          window.location.href = 'tenant-admin.html';
        } else if (role !== 'master_admin') {
          window.location.href = 'index.html';
        }
      }
    },

    signOut: function () {
      global.RBAC.logout();
      window.location.replace('master-login.html');
    },

    logout: function () {
      global.RBAC.logout();
      window.location.replace('master-login.html');
    },

    openAuthModal: function () {
      const s = global.RBAC.getSession();
      const meta = global.RBAC.getRoleMeta(s.role);
      const info = document.getElementById('admin-auth-info');
      if (info) {
        info.innerHTML = `<strong>Signed in as:</strong> ${esc(s.name)} (${esc(s.email)})<br><strong>Role:</strong> <span style="color:${meta.color};font-weight:bold;">${meta.label}</span> &middot; ${esc(s.tenant)}`;
      }
      document.getElementById('modal-admin-auth').style.display = 'flex';
    },

    closeModal: function (modalId) {
      const m = document.getElementById(modalId);
      if (m) m.style.display = 'none';
    }
  };

  global.MasterAdminApp = MasterAdminApp;
  window.addEventListener('DOMContentLoaded', MasterAdminApp.init);
})(typeof window !== 'undefined' ? window : globalThis);
