CXX=$(CROSS_COMPILE)g++
RM=rm

CXXSOURCES=main.cpp

INCLUDE =  -I$(INSTALL_DIR)/include
INCLUDE += -I$(INSTALL_DIR)/include/api2
INCLUDE += -I$(INSTALL_DIR)/include/apiApp
INCLUDE += -I$(INSTALL_DIR)/rp_sdk
INCLUDE += -I$(INSTALL_DIR)/rp_sdk/libjson

LIBS = -L$(INSTALL_DIR)/lib
LIBS += -L$(INSTALL_DIR)/rp_sdk

COMMON_FLAGS+=-Wall -fPIC -Os -s
CXXFLAGS+=$(COMMON_FLAGS) -std=c++11 $(INCLUDE)
LDFLAGS = -shared $(COMMON_FLAGS) $(LIBS)
LDFLAGS+= -Wl,--whole-archive,--no-as-needed
LDFLAGS+= -lcryptopp -lrpapp -lrp -lrp_sdk
LDFLAGS+= -Wl,--no-whole-archive

CXXOBJECTS=$(CXXSOURCES:.cpp=.o)
OBJECTS=$(CXXOBJECTS)

OUT_DIR=../
C_OUT_NAME=$(OUT_DIR)controllerhf.so

all: make_c_app

.cpp.o:
	$(CXX) -c $(CXXFLAGS) $< -o $@

make_c_app: $(OBJECTS)
	$(CXX) $(OBJECTS) -o $(C_OUT_NAME) $(LDFLAGS)

clean:
	-$(RM) -f $(C_OUT_NAME) $(OBJECTS)

#CC=$(CROSS_COMPILE)gcc
#RM=rm
#
#OBJECTS=main.o
#
#INCLUDE = -I$(INSTALL_DIR)/include
#INCLUDE += -I$(INSTALL_DIR)/include/api2
#INCLUDE += -I$(INSTALL_DIR)/include/apiApp
#INCLUDE += -I$(INSTALL_DIR)/rp_sdk
#INCLUDE += -I$(INSTALL_DIR)/rp_sdk/libjson
#
#LIBS = -L$(INSTALL_DIR)/lib
#LIBS += -L$(INSTALL_DIR)/rp_sdk
#
#CFLAGS+= -Wall -Werror -fPIC -Os -s -g $(INCLUDE)
#LDFLAGS= -shared -Wall -fPIC -Os -s $(LIBS) -Wl,--whole-archive,--no-as-needed -lcryptopp -lrpapp -lrp -lrp_sdk -Wl,--no-whole-archive
#
#CONTROLLER = ../controllerhf.so
#
#all: $(CONTROLLER)
#
#
#$(CONTROLLER): $(FFT_OBJECTS) $(OBJECTS)
#	$(CC) -o $(CONTROLLER) $(OBJECTS) $(FFT_OBJECTS) $(CFLAGS) $(LDFLAGS)
#
#clean:
#	$(RM) -f $(OBJECTS)
#	$(MAKE) -C $(FFT_DIR) clean
