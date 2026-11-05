# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Design Theme
LUCI_DEPENDS:=+luci-base
# csstidy lowercases property names, which breaks the case sensitive CSS
# custom properties of this theme (--activeColor vs var(--activeColor)),
# so ship the stylesheet unmodified.
LUCI_MINIFY_CSS:=0
# apk rejects a '-' inside the version body (only a trailing "-r<digits>"
# revision is allowed), so the release date is kept as a dotted component.
PKG_VERSION:=5.8.0.20240106
PKG_RELEASE:=2

# Register the theme at install time: luci.mk overrides default_postinst, so
# the uci-defaults script would otherwise only run on the next boot and the
# theme would be missing from the theme selector until then.
define Package/luci-theme-design/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	# Register the theme directly: luci.mk overrides default_postinst, and the
	# apk post-install script may run with PKG_UPGRADE=1, in which case the
	# uci-defaults script used to skip the registration entirely.
	if [ "$$(uci -q get luci.themes.Design)" != "/luci-static/design" ]; then
		uci set luci.themes.Design=/luci-static/design
		uci commit luci
	fi
	# Run the registration/activation script while it is still present.
	if [ -f /etc/uci-defaults/30_luci-theme-design ]; then
		( . /etc/uci-defaults/30_luci-theme-design )
	fi
	rm -f /etc/uci-defaults/30_luci-theme-design
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
