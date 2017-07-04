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
#include <inttypes.h>

#include "main.h"


//Signal size
#define SIGNAL_SIZE_DEFAULT      16385
//#define SIGNAL_UPDATE_INTERVAL      10
#define SIGNAL_UPDATE_INTERVAL      500



const char *rp_app_desc(void)
{
    return (const char *)"Multi Channel Analyser.\n";
}

//Signal
CFloatSignal HISTOGRAM("HISTOGRAM", SIGNAL_SIZE_DEFAULT, 0.0f);
std::vector<uint32_t> g_data(SIGNAL_SIZE_DEFAULT);

// Status of input 0 and 1 MCA
CIntSignal STATUS("STATUS", CBaseParameter::RW, 2, 0);
// 0: Not Started
// 1: Stopped
// 2: Running

// Timer for inputs 0 and 1 of MCA
CIntSignal TIMER_STATUS("TIMER_STATUS", CBaseParameter::RW, 2, 0);
CIntSignal TIMER_CONFIG("TIMER_CONFIG", CBaseParameter::RW, 2, 0);



//Parameters
//CIntParameter(std::string _name, CBaseParameter::AccessMode _access_mode, int _value, int _fpga_update, int _min, int _max)
CIntParameter COMMAND_CODE("COMMAND_CODE", CBaseParameter::RW, -1, 0, -1, 255);
CIntParameter COMMAND_CHAN("COMMAND_CHAN", CBaseParameter::RW, 0, 0, 0, 255);
CIntParameter COMMAND_DATA("COMMAND_DATA", CBaseParameter::RW, 0, 0, -2147483648,  2147483647); // Max range for a 32bit integer

int fd;
volatile uint32_t *slcr, *axi_hp0;
volatile uint8_t *sts, *cfg, *gen;
void* hst0;
void* hst1;
void *ram, *buf;
volatile uint8_t *rst[4];
volatile uint32_t *trg;
int status[2];
int timer_status[2];
int timer_config[2];

int rp_app_init(void)
{



    fprintf(stderr, "Loading Multi Channel Analyser\n");

    status[0] = 0;
    status[1] = 0;
    timer_status[0] = 0;
    timer_status[1] = 0;
    timer_config[0] = 0;
    timer_config[1] = 0;


    // TODO: Find a way to not reset everything in some cases
    int do_reset = 1;

    if (do_reset) {



      int exit_code1 = system("cat /opt/redpitaya/fpga/fpga_0.94.bit > /dev/xdevcfg");

      // Turns out we don't want to initialize the API!
      // This sets up a bunch of FPGA stuff like oscilooscope,
      // but we're using a custom FPGA image so avoid this.
      // Initialization of API
      if (rpApp_Init() != RP_OK) 
      {
          fprintf(stderr, "Red Pitaya API init failed!\n");
          return EXIT_FAILURE;
      }
      else fprintf(stderr, "Red Pitaya API init success!\n");


      int exit_code = system("cat /opt/redpitaya/www/apps/multichannelanalyser/mcpha.bit > /dev/xdevcfg");

      fprintf(stderr, "Loaded MCA FPGA image? %d\n", exit_code);
      
      if (exit_code != 0)
      {
          perror("Could not load custom FPGA image.");
          return 1;
      }




      // Open /dev/mem so we can memmap for FPGA stuff
      if ((fd = open("/dev/mem", O_RDWR)) < 0)
      {
          perror("Could not open /dev/mem");
          return 1;
      }

      // I beleive that the pagesize is 32 bytes?
      // These are all pointers / arrays into certain regions of RAM used to communicate with the FPGA
      slcr       = (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0xF8000000);
      axi_hp0    = (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0xF8008000);
      trg        = (uint32_t*) mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40002000);
      sts        = (uint8_t*)  mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40000000);
      cfg        = (uint8_t*)  mmap(NULL,      sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40001000);
      hst0       = (char*)     mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40010000);
      hst1       = (char*)     mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40020000);
      gen        = (uint8_t*)  mmap(NULL,   16*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x40030000);
      ram        = (char*)     mmap(NULL, 8192*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0x1E000000);
      buf        = (char*)     mmap(NULL, 8192*sysconf(_SC_PAGESIZE), PROT_READ|PROT_WRITE, MAP_SHARED|MAP_ANONYMOUS, -1, 0);

      /* Fill rst with pointers into cfg */
      rst[0] = &(cfg[0]);
      rst[1] = &(cfg[1]);
      rst[2] = &(cfg[2]);
      rst[3] = &(cfg[3]);

      /* Set FPGA clock to 143 MHz and HP0 bus width to 64 bits, somehow */
      /* FPGA clock is set to 143MHz so that it's faster than ADC clock and wont miss data */
      slcr[2] = 0xDF0D;
      slcr[92] = (slcr[92] & ~0x03F03F30) | 0x00100700;
      slcr[144] = 0;
      axi_hp0[0] &= ~1; // Turning off last bit?
      axi_hp0[5] &= ~1; // Turning off last bit?
      
      /* set sample rate */
      *(uint16_t *)(cfg + 4) = 125; // 125MHz sample rate from ADC
      
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
    }


    //Set signal update interval
    CDataManager::GetInstance()->SetSignalInterval(SIGNAL_UPDATE_INTERVAL);
    CDataManager::GetInstance()->SetParamInterval(SIGNAL_UPDATE_INTERVAL);

    return 0;
}

// int custom_load_fpga(void) {
//         fprintf(stderr, "Loading specific FPGA from: '%s'\n", fpga_name);
//     /* Try loading FPGA code
//         *    - Test if fpga loaded correctly
//         *    - Read/write permissions
//         *    - File exists/not exists */
//     switch (rp_bazaar_app_load_fpga(fpga_name)) {
//         case FPGA_FIND_ERR:
//             if (fpga_name)  free(fpga_name);
//             return rp_module_cmd_error(json_root, "Cannot find fpga file.", NULL, r->pool);
//         case FPGA_READ_ERR:
//             if (fpga_name)  free(fpga_name);
//             return rp_module_cmd_error(json_root, "Unable to read FPGA file.", NULL, r->pool);
//         case FPGA_WRITE_ERR:
//             if (fpga_name)  free(fpga_name);
//             return rp_module_cmd_error(json_root, "Unable to write FPGA file into memory.", NULL, r->pool);
//         /* App is a new app and doesn't need custom fpga.bit */
//         case FPGA_NOT_REQ:
//             if (fpga_name)  free(fpga_name);
//             break;
//         case FPGA_OK:
//         {
//             if (fpga_name)  free(fpga_name);
//             len = strlen((char *)lc->bazaar_dir.data) + strlen(argv[0]) + strlen("/fpga.sh") + 2;
//             char dmaDrv[len];
//             sprintf(dmaDrv, "%s/%s/fpga.sh", lc->bazaar_dir.data, argv[0]);
//             if (system(dmaDrv))
//                 fprintf(stderr, "Problem running %s\n", dmaDrv);
//             break;
//         }
//         default:
//             if (fpga_name)  free(fpga_name);
//             return rp_module_cmd_error(json_root, "Unknown error.", NULL, r->pool);
//     }
// }


int rp_app_exit(void)
{
    // This doesn't ever seem to get called
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
    // *sig_num=0;
    // *sig_len=0;
    return 0;
}



void UpdateSignals(void){

    STATUS[0] = status[0];
    STATUS[1] = status[1];

    TIMER_STATUS[0] = timer_status[0];
    TIMER_STATUS[1] = timer_status[1];
    TIMER_CONFIG[0] = timer_config[0];
    TIMER_CONFIG[1] = timer_config[1];

    //Write data to signal
    for(int i = 0; i < SIGNAL_SIZE_DEFAULT; i++) 
    {
        HISTOGRAM[i] = g_data[i];
    }
}


void UpdateParams(void){}


void OnNewParams(void) 
{
    COMMAND_CODE.Update();
    COMMAND_CHAN.Update();
    COMMAND_DATA.Update();

    int code = (uint8_t)  COMMAND_CODE.Value();
    int chan = (uint8_t)  COMMAND_CHAN.Value();
    uint32_t data = (uint32_t) COMMAND_DATA.Value();

    // Print out what commands we receive.
    // Skip this for the update histogram and update timer commands
    // since we get so many of them.
    if (code!=14 && code!=13) {
      fprintf(stderr, "-------------------\n");
      fprintf(stderr, "Command code: %d\n", code);
      fprintf(stderr, "Command chan: %d\n", chan);
      fprintf(stderr, "Command data: %zu\n", data);
    }


    if (chan < 0 || chan > 1) {
      fprintf(stderr, "ERROR: Channel must be 0 or 1");
    }
    else if (code==-1) {
        // Nothing to do
    }
    else if(code == 0)
      {
        /* reset timer */
        if(chan == 0)
        {
          *rst[0] &= ~2;
          *rst[0] |= 2;
        }
        else if(chan == 1)
        {
          *rst[1] &= ~2;
          *rst[1] |= 2;
        }
      }
      else if(code == 1)
      {
        /* reset histogram*/
        if(chan == 0)
        {
          *rst[0] &= ~1;
          *rst[0] |= 1;
        }
        else if(chan == 1)
        {
          *rst[1] &= ~1;
          *rst[1] |= 1;
        }
      }
      else if(code == 2)
      {
        /* reset oscilloscope */
        *rst[2] &= ~3;
        *rst[2] |= 3;
      }
      else if(code == 3)
      {
        /* reset generator */
        *rst[3] &= ~128;
        *rst[3] |= 128;
      }
      else if(code == 4)
      {
        /* set sample rate */
        // This is the decimation parameter to the CIC filterthat controls
        // the data rate to the FIR filter, and then the PHA core.
        *(uint16_t *)(cfg + 4) = data;
      }
      else if(code == 5)
      {
        /* set negator mode (0 for disabled, 1 for enabled) */
        if(chan == 0)
        {
          if(data == 0)
          {
            *rst[0] &= ~16;
          }
          else if(data == 1)
          {
            *rst[0] |= 16;
          }
        }
        else if(chan == 1)
        {
          if(data == 0)
          {
            *rst[1] &= ~16;
          }
          else if(data == 1)
          {
            *rst[1] |= 16;
          }
        }
      }
      else if(code == 6)
      {
        /* set baseline mode (0 for none, 1 for auto) */
        if(chan == 0)
        {
          if(data == 0)
          {
            *rst[0] &= ~4;
          }
          else if(data == 1)
          {
            *rst[0] |= 4;
          }
        }
        else if(chan == 1)
        {
          if(data == 0)
          {
            *rst[1] &= ~4;
          }
          else if(data == 1)
          {
            *rst[1] |= 4;
          }
        }
      }
      else if(code == 7)
      {
        /* set baseline level */
        if(chan == 0)
        {
          *(uint16_t *)(cfg + 16) = data;
        }
        else if(chan == 1)
        {
          *(uint16_t *)(cfg + 32) = data;
        }
      }
      else if(code == 8)
      {
        /* set pha delay */
        if(chan == 0)
        {
          *(uint16_t *)(cfg + 18) = data;
        }
        else if(chan == 1)
        {
          *(uint16_t *)(cfg + 34) = data;
        }
      }
      else if(code == 9)
      {
        /* set pha min threshold */
        if(chan == 0)
        {
          *(uint16_t *)(cfg + 20) = data;
        }
        else if(chan == 1)
        {
          *(uint16_t *)(cfg + 36) = data;
        }
      }
      else if(code == 10)
      {
        /* set pha max threshold */
        if(chan == 0)
        {
          *(uint16_t *)(cfg + 22) = data;
        }
        else if(chan == 1)
        {
          *(uint16_t *)(cfg + 38) = data;
        }
      }
      else if(code == 11)
      {
        /* set timer */
        if(chan == 0)
        {
          *(uint64_t *)(cfg + 8) = ((uint64_t)data)*125000000ULL;
        }
        else if(chan == 1)
        {
          *(uint64_t *)(cfg + 24) = ((uint64_t)data)*125000000ULL;
        }
      }
      // I think this is the start-mca command
      else if(code == 12)
      {
        // Update status signal
        status[chan] = (data == 0 ? 2 : 1);
        /* set timer mode (0 for stop, 1 for running) */
        if(chan == 0)
        {
          if(data == 0)
          {
            *rst[0] &= ~8;
          }
          else if(data == 1)
          {
            *rst[0] |= 8;
          }
        }
        else if(chan == 1)
        {
          if(data == 0)
          {
            *rst[1] &= ~8;
          }
          else if(data == 1)
          {
            *rst[1] |= 8;
          }
        }
      }
      else if(code == 13)
      {
        uint64_t data1 = 0;
        uint64_t data2 = 0;
        /* read timer */
        if(chan == 0)
        {
          data1 = *(uint64_t *)(sts + 12)/125000000ULL;
          data2 = *(uint64_t *)(cfg + 8)/125000000ULL;
        }
        else if(chan == 1)
        {
          data1 = *(uint64_t *)(sts + 20)/125000000ULL;
          data2 = *(uint64_t *)(cfg + 24)/125000000ULL;
        }
        timer_status[chan] = (int) data1;
        timer_config[chan] = (int) data2;

        // fprintf(stderr, "STATUS (%d) / (%d)\n",  (int) data1, (int) data2);

        // Reset status if timer has completed
        if (timer_status[chan] >= timer_config[chan] && status[chan] != 0) {
          status[chan] = 2;
        }
      }
      else if(code == 14)
      {
        /* read histogram */
        // {
          int bufsize = (SIGNAL_SIZE_DEFAULT-1)*sizeof(uint32_t);
          memcpy(buf, chan ==0 ? hst0 : hst1, bufsize);

          memcpy(g_data.data(), buf, bufsize);

          // uint32_t total = 0;
          // for (int i=0; i< bufsize; i+=4) {
          //   uint32_t f = *(uint32_t *)(buf + i);
          //   total += f;
          // }
          // fprintf(stderr, "Total counts: %" PRIu32 "\n", total);


      }
                // else if(code == 15)
                // {
                //   /* set trigger source (0 for channel 1, 1 for channel 2) */
                //   if(chan == 0)
                //   {
                //     trg[16] = 0;
                //     trg[0] = 2;
                //   }
                //   else if(chan == 1)
                //   {
                //     trg[16] = 1;
                //     trg[0] = 2;
                //   }
                // }
                // else if(code == 16)
                // {
                //   /* set trigger slope (0 for rising, 1 for falling) */
                //   if(data == 0)
                //   {
                //     *rst[2] &= ~4;
                //   }
                //   else if(data == 1)
                //   {
                //     *rst[2] |= 4;
                //   }
                // }
                // else if(code == 17)
                // {
                //   /* set trigger mode (0 for normal, 1 for auto) */
                //   if(data == 0)
                //   {
                //     *rst[2] &= ~8;
                //   }
                //   else if(data == 1)
                //   {
                //     *rst[2] |= 8;
                //   }
                // }
                // else if(code == 18)
                // {
                //   /* set trigger level */
                //   *(uint16_t *)(cfg + 80) = data;
                // }
                // else if(code == 19)
                // {
                //   /* set number of samples before trigger */
                //   *(uint32_t *)(cfg + 72) = data - 1;
                // }
                // else if(code == 20)
                // {
                //   /* set total number of samples */
                //   *(uint32_t *)(cfg + 76) = data - 1;
                // }
                // else if(code == 21)
                // {
                //   /* start oscilloscope */
                //   *rst[2] |= 16;
                //   *rst[2] &= ~16;
                // }
                // else if(code == 22)
                // {
                //   /* read oscilloscope status */
                //   *(uint32_t *)buf = *(uint32_t *)(sts + 44) & 1;
                //   fprintf(stderr, "TODO-SEND OSC STATUS %d\n", sts[44]&1);
                  
                //   //if(send(sock_client, buf, 4, MSG_NOSIGNAL) < 0) break;
                // }
                // else if(code == 23)
                // {
        /* read oscilloscope data */
        // pre = *(uint32_t *)(cfg + 72) + 1;
        // tot = *(uint32_t *)(cfg + 76) + 1;
        // start = *(uint32_t *)(sts + 44) >> 1;
        // start = (start - pre) & 0x007FFFFF;
        // if(start + tot <= 0x007FFFFF)
        // {
        //   memcpy(buf, ram + start * 4, tot * 4);
        //   fprintf(stderr, "TODO-SEND OSC DATA");
        // //   if(send(sock_client, buf, tot * 4, MSG_NOSIGNAL) < 0) break;
        // }
        // else
        // {
        //   fprintf(stderr, "TODO-SEND OSC DATA2");
        //   memcpy(buf, ram + start * 4, (0x007FFFFF - start) * 4);
        // //   if(send(sock_client, buf, (0x007FFFFF - start) * 4, MSG_NOSIGNAL) < 0) break;
        //   memcpy(buf, ram, (start + tot - 0x007FFFFF) * 4);
        // //   if(send(sock_client, buf, (start + tot - 0x007FFFFF) * 4, MSG_NOSIGNAL) < 0) break;
        // }
      // } 
      else{
          fprintf(stderr, "UNKOWN CODE: %d\n", code);
      }
}


void OnNewSignals(void){}

void PostUpdateSignals(void){}
