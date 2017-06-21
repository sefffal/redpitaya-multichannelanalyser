# make clean && rw && make install && tail -f /var/log/redpitaya_nginx/debug.log
# $Id: Makefile 1235 2014-02-21 16:44:10Z ales.bardorfer $
#
# Red Pitaya specific application Makefile.
#

APP=$(notdir $(CURDIR:%/=%))

# Versioning system
BUILD_NUMBER ?= 0
REVISION ?= devbuild
VER:=$(shell cat info/info.json | grep version | sed -e 's/.*:\ *\"//' | sed -e 's/-.*//')

INSTALL_DIR ?= .

CONTROLLERHF = controllerhf.so
ZIP = $(APP)-$(VER)-$(BUILD_NUMBER)-$(REVISION).zip

CFLAGS += -DVERSION=$(VER)-$(BUILD_NUMBER) -DREVISION=$(REVISION)
export CFLAGS

all: $(CONTROLLERHF)

$(CONTROLLERHF):
	$(MAKE) -C src

$(ZIP): $(CONTROLLERHF) index.html fpga.conf js/app.js css/style.css src/main.cpp assets/* vendor/*
	-$(RM) target -rf
	mkdir -p target/$(APP)
	cp -r $(CONTROLLERHF) fpga.conf info js css index.html mcpha.bit assets vendor target/$(APP)
	sed -i target/$(APP)/info/info.json -e 's/REVISION/$(REVISION)/'
	sed -i target/$(APP)/info/info.json -e 's/BUILD_NUMBER/$(BUILD_NUMBER)/'
	$(RM) -f ../$(ZIP)
	cd target; zip -qr ../$(ZIP) *
	$(RM) target -rf
	@echo Created zip file.

install: $(ZIP)
	rw
	unzip -q -o $(ZIP) -d $(INSTALL_DIR)/www/apps
	systemctl restart redpitaya_nginx
	@echo "----------------------------------------"
	@echo Install Successful.
	@echo To check server output, run:
	@echo tail -n0 -f /var/log/redpitaya_nginx/debug.log
	@echo "----------------------------------------"

clean:
	-$(RM) *.so
	$(MAKE) -C src clean
	-$(RM) target -rf
