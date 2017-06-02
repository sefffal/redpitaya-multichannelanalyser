#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/types.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/sysinfo.h>

#include "main.h"

const char *rp_app_desc(void)
{
    return (const char *)"Multi Channel Analyser.\n";
}


int rp_app_init(void)
{
	int fd;
	volatile uint32_t *slcr, *axi_hp0;
	volatile uint8_t *sts, *cfg, *gen;
	void *hst[2], *ram, *buf;
	volatile uint8_t *rst[4];
	volatile uint32_t *trg;


    fprintf(stderr, "Loading Multi Channel Analyser\n");


    // Initialization of API
    if (rp_Init() != RP_OK) 
    {
        fprintf(stderr, "Red Pitaya API init failed!\n");
        return EXIT_FAILURE;
    }
    else fprintf(stderr, "Red Pitaya API init success!\n");
	return 0;

	int exit_code = system("cat /opt/redpitaya/www/apps/multichannelanalyser/mcpha.bit > /dev/xdevcfg");

	fprintf(stderr, "Loaded FPGA image? %d", exit_code);
	return 0;
	// Open /dev/mem so we can memmap for FPGA stuff
	if ((fd = open("/dev/mem", O_RDWR)) < 0)
	{
		perror("Could not open /dev/mem");
		return 1;
	}

	// I beleive that the pagesize is 32 bytes?
    slcr	= (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0xF8000000);
    axi_hp0 = (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0xF8008000);
    trg		= (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40002000);
    sts		= (uint8_t*)  mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40000000);
    cfg		= (uint8_t*)  mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40001000);
    hst[0]	= (char*)     mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40010000);
    hst[1]	= (char*)     mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40020000);
    gen		= (uint8_t*)  mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40030000);
    ram		= (char*)     mmap(NULL, 8192*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x1E000000);
    buf		= (char*)     mmap(NULL, 8192*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED|MAP_ANONYMOUS, -1, 0);

	return 0;
    /*rst[0] = cfg + 0;
	rst[1] = cfg + 1;
	rst[2] = cfg + 2;
	rst[3] = cfg + 3;*/


	/* Fill rst with pointers into cfg */
	rst[0] = &(cfg[0]);
	rst[1] = &(cfg[1]);
	rst[2] = &(cfg[2]);
	rst[3] = &(cfg[3]);

	/* Set FPGA clock to 143 MHz and HP0 bus width to 64 bits, somehow */
    slcr[2] = 0xDF0D;
    slcr[92] = (slcr[92] & ~0x03F03F30) | 0x00100700;
    slcr[144] = 0;
    axi_hp0[0] &= ~1;
    axi_hp0[5] &= ~1;
    
    /* set sample rate */
    *(uint16_t *)(cfg + 4) = 125;
    
    /* set trigger channel */
    trg[16] = 0;
    trg[0] = 2;
    
    /* reset timers and histograms */
    *rst[0] &= ~3;
    *rst[0] |= 3;
    *rst[1] &= ~3;
    *rst[1] |= 3;
    
    /* reset oscilloscope */
    *rst[2] &= ~3;
    *rst[2] |= 3;
    
    /* reset generator */
    *rst[3] &= ~128;
    *rst[3] |= 128;

    return 0;
}


int rp_app_exit(void)
{
    fprintf(stderr, "Unloading Multi Channel Analyser\n");

    rpApp_Release();

    return 0;
}


int rp_set_params(rp_app_params_t *p, int len)
{
    return 0;
}


int rp_get_params(rp_app_params_t **p)
{
    return 0;
}


int rp_get_signals(float ***s, int *sig_num, int *sig_len)
{
	// By recomendation of https://forum.redpitaya.com/viewtopic.php?f=14&t=1826
	*sig_num=0;
	*sig_len=0;
    return 0;
}



void UpdateSignals(void){}


void UpdateParams(void){}


void OnNewParams(void) 
{
}


void OnNewSignals(void){}

void PostUpdateSignals(void){}
